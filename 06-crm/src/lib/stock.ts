import type { Prisma, StockDocType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

export async function nextDocNumber(prefix: string) {
  const count = await prisma.stockDocument.count();
  return `${prefix}${String(count + 1).padStart(6, "0")}`;
}

export async function nextSaleNumber() {
  const count = await prisma.sale.count();
  return `S${String(count + 1).padStart(6, "0")}`;
}

export async function nextOrderNumber() {
  const count = await prisma.order.count();
  return `O${String(count + 1).padStart(6, "0")}`;
}

export async function applyBalance(tx: Tx, storeId: string, productId: string, delta: number) {
  const existing = await tx.stockBalance.findUnique({
    where: { storeId_productId: { storeId, productId } },
  });
  const next = (existing?.qty ?? 0) + delta;
  if (next < 0) throw new Error("Недостаточно остатка на складе");
  if (existing) {
    await tx.stockBalance.update({ where: { id: existing.id }, data: { qty: next } });
  } else {
    await tx.stockBalance.create({ data: { storeId, productId, qty: next } });
  }
}

export async function postStockDocument(documentId: string) {
  const doc = await prisma.stockDocument.findUnique({
    where: { id: documentId },
    include: { lines: { include: { product: true } } },
  });
  if (!doc) throw new Error("Документ не найден");
  if (doc.postedAt) throw new Error("Документ уже проведён");

  await prisma.$transaction(async (tx) => {
    for (const line of doc.lines) {
      switch (doc.type as StockDocType) {
        case "receipt":
        case "customer_return": {
          await applyBalance(tx, doc.storeId, line.productId, line.qty);
          if (line.serial && line.product.serialTracked) {
            await tx.productSerial.upsert({
              where: { productId_serial: { productId: line.productId, serial: line.serial } },
              update: { storeId: doc.storeId, status: "in_stock" },
              create: {
                productId: line.productId,
                storeId: doc.storeId,
                serial: line.serial,
                status: "in_stock",
              },
            });
          }
          break;
        }
        case "supplier_return":
        case "writeoff": {
          await applyBalance(tx, doc.storeId, line.productId, -line.qty);
          if (line.serial) {
            await tx.productSerial.updateMany({
              where: { productId: line.productId, serial: line.serial },
              data: { status: "written_off" },
            });
          }
          break;
        }
        case "transfer": {
          if (!doc.toStoreId) throw new Error("Не указан склад назначения");
          await applyBalance(tx, doc.storeId, line.productId, -line.qty);
          await applyBalance(tx, doc.toStoreId, line.productId, line.qty);
          if (line.serial) {
            await tx.productSerial.updateMany({
              where: { productId: line.productId, serial: line.serial },
              data: { storeId: doc.toStoreId, status: "in_stock" },
            });
          }
          break;
        }
        case "inventory": {
          const delta = line.qtyActual - line.qtyAccount;
          if (delta !== 0) await applyBalance(tx, doc.storeId, line.productId, delta);
          break;
        }
        default:
          break;
      }
    }

    await tx.stockDocument.update({
      where: { id: documentId },
      data: { postedAt: new Date() },
    });
  });
}

export function lineTotal(
  unitPrice: number,
  qty: number,
  discountType: "none" | "amount" | "percent",
  discountValue: number,
) {
  const gross = unitPrice * qty;
  if (discountType === "amount") return Math.max(0, gross - discountValue);
  if (discountType === "percent") return Math.max(0, Math.round(gross * (1 - discountValue / 100)));
  return gross;
}
