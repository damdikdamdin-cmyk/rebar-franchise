"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { DiscountType, StockDocType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { assertStoreAccess, canEditCatalog, isUk } from "@/lib/access";
import { applyBalance, lineTotal, nextDocNumber, nextOrderNumber, nextSaleNumber, postStockDocument } from "@/lib/stock";
import { ensureStoreCash, postCashTxn } from "@/lib/cash";
import { nextProductBarcode } from "@/lib/barcode";
import { writeChangeLog } from "@/lib/audit";
import { can, type PermissionKey } from "@/lib/permissions";
import { requireUserWithAccess } from "@/lib/session-access";
import { getOpenInventory } from "@/lib/inventory-lock";
import { normalizePhone } from "@/lib/phone";

async function loadStore(storeId: string) {
  const user = await requireUserWithAccess();
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store || !assertStoreAccess(user, store)) redirect("/");
  return { user, store };
}

function requirePerm(user: Awaited<ReturnType<typeof requireUserWithAccess>>, key: PermissionKey, storeId: string) {
  if (!can(user, key)) redirect(`/stores/${storeId}`);
}

function revalidateStore(storeId: string) {
  revalidatePath(`/stores/${storeId}`);
  revalidatePath(`/stores/${storeId}/stock`);
  revalidatePath(`/stores/${storeId}/pos`);
  revalidatePath(`/stores/${storeId}/receipts`);
  revalidatePath(`/stores/${storeId}/transfers`);
  revalidatePath(`/stores/${storeId}/returns`);
  revalidatePath(`/stores/${storeId}/inventories`);
  revalidatePath(`/stores/${storeId}/writeoffs`);
  revalidatePath(`/stores/${storeId}/cash`);
  revalidatePath(`/stores/${storeId}/transactions`);
  revalidatePath(`/stores/${storeId}/cashflow`);
  revalidatePath(`/stores/${storeId}/orders`);
  revalidatePath(`/stores/${storeId}/reports`);
  revalidatePath(`/stores/${storeId}/payroll`);
  revalidatePath("/catalog/products");
  revalidatePath("/");
}

export async function upsertProduct(formData: FormData) {
  const user = await requireUserWithAccess();
  if (!canEditCatalog(user.role) && !can(user, "prices.editCatalog")) redirect("/");
  const id = String(formData.get("id") ?? "");
  const data = {
    code: String(formData.get("code") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    barcode: String(formData.get("barcode") ?? "").trim() || null,
    sku: String(formData.get("sku") ?? "").trim() || null,
    groupId: String(formData.get("groupId") ?? "") || null,
    supplierId: String(formData.get("supplierId") ?? "") || null,
    unit: String(formData.get("unit") ?? "шт") || "шт",
    warrantyDays: Number(formData.get("warrantyDays") || 365),
    serialTracked: formData.get("serialTracked") === "on",
    purchasePrice: Number(formData.get("purchasePrice") || 0),
    retailPrice: Number(formData.get("retailPrice") || 0),
    repairPrice: Number(formData.get("repairPrice") || 0),
    preorderPrice: Number(formData.get("preorderPrice") || 0),
    minStock: Number(formData.get("minStock") || 0),
    commissionPct: Number(formData.get("commissionPct") || 0),
    commissionRub: Number(formData.get("commissionRub") || 0),
    description: String(formData.get("description") ?? "").trim() || null,
    active: formData.get("active") !== "off",
  };
  if (!data.code || !data.name) return;
  if (data.groupId === "__none__") data.groupId = null;
  if (data.supplierId === "__none__") data.supplierId = null;

  if (!data.barcode) data.barcode = await nextProductBarcode(prisma, data.code);

  const serialStoreId = String(formData.get("serialStoreId") ?? "").trim();
  const newSerials = String(formData.get("newSerials") ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  async function attachSerials(productId: string) {
    if (!data.serialTracked || !serialStoreId || !newSerials.length) return;
    const store = await prisma.store.findUnique({ where: { id: serialStoreId } });
    if (!store) return;
    for (const serial of newSerials) {
      const existing = await prisma.productSerial.findUnique({
        where: { productId_serial: { productId, serial } },
      });
      if (existing) continue;
      await prisma.productSerial.create({
        data: { productId, storeId: serialStoreId, serial, status: "in_stock" },
      });
      await applyBalance(prisma, serialStoreId, productId, 1);
    }
  }

  if (id) {
    await prisma.product.update({ where: { id }, data });
    await attachSerials(id);
    revalidatePath("/catalog/products");
    revalidatePath(`/catalog/products/${id}`);
    redirect(`/catalog/products/${id}`);
  }
  const product = await prisma.product.create({ data });
  await attachSerials(product.id);
  revalidatePath("/catalog/products");
  redirect(`/catalog/products/${product.id}`);
}

export async function createProductGroup(formData: FormData) {
  const user = await requireUser();
  if (!canEditCatalog(user.role)) redirect("/");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.productGroup.create({ data: { name } });
  revalidatePath("/catalog/products");
}

export async function createSupplier(formData: FormData) {
  const user = await requireUser();
  if (!canEditCatalog(user.role)) redirect("/");
  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? "")) || null;
  if (!name) return;
  await prisma.supplier.create({ data: { name, phone } });
  revalidatePath("/catalog/products");
}

export async function completeSale(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const { user } = await loadStore(storeId);

  const openInv = await getOpenInventory(storeId);
  if (openInv) {
    redirect(`/stores/${storeId}/pos?error=inventory`);
  }

  const payload = String(formData.get("payload") ?? "");
  let lines: Array<{
    productId: string;
    name: string;
    qty: number;
    unitPrice: number;
    discountType: DiscountType;
    discountValue: number;
    serial?: string;
  }> = [];
  try {
    lines = JSON.parse(payload);
  } catch {
    return;
  }
  if (!lines.length) return;

  // Проверка прав на скидку / правку цены
  for (const line of lines) {
    if (line.discountType !== "none" && line.discountValue > 0 && !can(user, "sales.discount")) {
      redirect(`/stores/${storeId}/pos?error=discount`);
    }
  }

  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const customerName = String(formData.get("customerName") ?? "").trim();
  const creditAmount = Number(formData.get("creditAmount") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;
  const printKeys = [
    formData.get("printReceipt") ? "receipt" : null,
    formData.get("printWarranty") ? "warranty" : null,
  ].filter(Boolean) as string[];

  let customerId: string | null = null;
  if (phone) {
    const customer = await prisma.customer.upsert({
      where: { storeId_phone: { storeId, phone } },
      update: { name: customerName || undefined },
      create: { storeId, name: customerName || "Клиент", phone },
    });
    customerId = customer.id;
  }

  const computed = lines.map((line) => ({
    ...line,
    serial: line.serial?.trim() || "",
    lineTotal: lineTotal(line.unitPrice, line.qty, line.discountType, line.discountValue),
  }));
  const amount = computed.reduce((s, l) => s + l.lineTotal, 0);
  const discountTotal = computed.reduce(
    (s, l) => s + (l.unitPrice * l.qty - l.lineTotal),
    0,
  );

  const number = await nextSaleNumber();
  const products = await prisma.product.findMany({
    where: { id: { in: computed.map((l) => l.productId) } },
    select: { id: true, warrantyDays: true, serialTracked: true, purchasePrice: true },
  });
  const productMeta = new Map(products.map((p) => [p.id, p]));

  const sale = await prisma.$transaction(async (tx) => {
    const saleLines: Array<{
      productId: string;
      name: string;
      qty: number;
      unitPrice: number;
      costPrice: number;
      discountType: DiscountType;
      discountValue: number;
      lineTotal: number;
      serial: string | null;
      warrantyDays: number | null;
    }> = [];

    for (const line of computed) {
      const meta = productMeta.get(line.productId);
      let costPrice = meta?.purchasePrice ?? 0;
      if (meta?.serialTracked) {
        if (!line.serial) throw new Error("Для серийного товара нужен IMEI / S/N");
        if (line.qty !== 1) throw new Error("Серийный товар продаётся по 1 шт. с IMEI / S/N");
        const serialRow = await tx.productSerial.findFirst({
          where: {
            productId: line.productId,
            storeId,
            serial: line.serial,
            status: "in_stock",
          },
        });
        if (!serialRow) {
          throw new Error(`IMEI / S/N не найден на складе: ${line.serial}`);
        }
        costPrice = serialRow.purchasePrice ?? costPrice;
        await tx.productSerial.update({
          where: { id: serialRow.id },
          data: { status: "sold" },
        });
        saleLines.push({
          productId: line.productId,
          name: line.name,
          qty: line.qty,
          unitPrice: line.unitPrice,
          costPrice,
          discountType: line.discountType,
          discountValue: line.discountValue,
          lineTotal: line.lineTotal,
          serial: line.serial || null,
          warrantyDays: serialRow.warrantyDays ?? meta?.warrantyDays ?? null,
        });
        await applyBalance(tx, storeId, line.productId, -line.qty);
        continue;
      } else if (line.serial) {
        const serialRow = await tx.productSerial.findFirst({
          where: { productId: line.productId, storeId, serial: line.serial, status: "in_stock" },
        });
        if (serialRow) {
          costPrice = serialRow.purchasePrice ?? costPrice;
          await tx.productSerial.update({
            where: { id: serialRow.id },
            data: { status: "sold" },
          });
          saleLines.push({
            productId: line.productId,
            name: line.name,
            qty: line.qty,
            unitPrice: line.unitPrice,
            costPrice,
            discountType: line.discountType,
            discountValue: line.discountValue,
            lineTotal: line.lineTotal,
            serial: line.serial || null,
            warrantyDays: serialRow.warrantyDays ?? meta?.warrantyDays ?? null,
          });
          await applyBalance(tx, storeId, line.productId, -line.qty);
          continue;
        }
      }
      await applyBalance(tx, storeId, line.productId, -line.qty);
      saleLines.push({
        productId: line.productId,
        name: line.name,
        qty: line.qty,
        unitPrice: line.unitPrice,
        costPrice,
        discountType: line.discountType,
        discountValue: line.discountValue,
        lineTotal: line.lineTotal,
        serial: line.serial || null,
        warrantyDays: meta?.warrantyDays ?? null,
      });
    }
    const created = await tx.sale.create({
      data: {
        storeId,
        customerId,
        sellerUserId: user.id,
        amount,
        creditAmount: Math.max(0, Math.round(creditAmount)),
        discountTotal,
        note,
        number,
        lines: { create: saleLines },
      },
      include: { lines: true },
    });
    for (const sl of created.lines) {
      await writeChangeLog(
        {
          storeId,
          userId: user.id,
          entityType: "sale",
          entityId: created.id,
          action: "sell",
          summary: `Продажа ${number}: ${sl.name}${sl.serial ? ` · IMEI ${sl.serial}` : ""} · ${sl.lineTotal} ₽ (закуп ${sl.costPrice})`,
          productId: sl.productId,
          serialNew: sl.serial,
          saleId: created.id,
          meta: {
            unitPrice: sl.unitPrice,
            costPrice: sl.costPrice,
            warrantyDays: sl.warrantyDays,
          },
        },
        tx,
      );
      if (sl.serial) {
        const ser = await tx.productSerial.findFirst({
          where: { productId: sl.productId ?? undefined, serial: sl.serial },
        });
        if (ser) {
          await writeChangeLog(
            {
              storeId,
              userId: user.id,
              entityType: "serial",
              entityId: ser.id,
              action: "sell",
              summary: `Выдан в продаже ${number}`,
              productId: sl.productId,
              serialId: ser.id,
              serialNew: sl.serial,
              saleId: created.id,
            },
            tx,
          );
        }
      }
    }
    return created;
  });

  const cashIn = amount - Math.max(0, Math.round(creditAmount));
  if (cashIn > 0) {
    const register = await ensureStoreCash(storeId);
    await postCashTxn({
      registerId: register.id,
      direction: "in",
      amount: cashIn,
      categoryName: "Продажа",
      saleId: sale.id,
      userId: user.id,
      note: sale.number ?? undefined,
    });
  }

  revalidateStore(storeId);
  const printQs = printKeys.length ? `&print=${printKeys.join(",")}` : "";
  redirect(`/stores/${storeId}/pos?sold=${sale.id}${printQs}`);
}

export async function createStockDoc(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const type = String(formData.get("type") ?? "") as StockDocType;
  const { user } = await loadStore(storeId);
  const createKey: Partial<Record<StockDocType, PermissionKey>> = {
    receipt: "receipts.create",
    transfer: "transfers.create",
    customer_return: "returns.create",
    supplier_return: "returns.create",
    inventory: "inventory.create",
    writeoff: "writeoffs.create",
  };
  const key = createKey[type];
  if (key) requirePerm(user, key, storeId);
  const comment = String(formData.get("comment") ?? "").trim() || null;
  const toStoreId = String(formData.get("toStoreId") ?? "") || null;
  const supplierId = String(formData.get("supplierId") ?? "") || null;
  const payload = String(formData.get("payload") ?? "[]");
  let rawLines: Array<{
    productId?: string | null;
    name?: string;
    code?: string;
    barcode?: string;
    qty: number;
    price?: number;
    retailPrice?: number;
    warrantyDays?: number;
    serial?: string;
    serialTracked?: boolean;
    qtyAccount?: number;
    qtyActual?: number;
  }> = [];
  try {
    rawLines = JSON.parse(payload);
  } catch {
    return;
  }
  if (!rawLines.length) return;

  const serialsSeen = new Set<string>();
  for (const line of rawLines) {
    const sn = (line.serial ?? "").trim();
    if (!sn) continue;
    const key = sn.toLowerCase();
    if (serialsSeen.has(key)) {
      redirect(`/stores/${storeId}/receipts?error=dup_imei`);
    }
    serialsSeen.add(key);
  }

  const lines = await Promise.all(
    rawLines.map(async (line) => {
      const productId = await ensureProductForReceiptLine({
        productId: line.productId,
        name: line.name,
        code: line.code,
        barcode: line.barcode,
        purchasePrice: line.price ?? 0,
        retailPrice: line.retailPrice ?? 0,
        warrantyDays: line.warrantyDays,
        serialTracked: Boolean(line.serialTracked || line.serial),
      });
      return {
        productId,
        qty: line.qty,
        price: line.price ?? 0,
        retailPrice: line.retailPrice ?? 0,
        warrantyDays: line.warrantyDays,
        serial: line.serial,
        qtyAccount: line.qtyAccount,
        qtyActual: line.qtyActual,
      };
    }),
  );

  const prefixes: Record<StockDocType, string> = {
    receipt: "C",
    transfer: "T",
    customer_return: "F",
    supplier_return: "R",
    inventory: "I",
    writeoff: "W",
  };

  const externalNumber = String(formData.get("externalNumber") ?? "").trim() || null;
  const externalDateRaw = String(formData.get("externalDate") ?? "").trim();
  const externalDate = externalDateRaw ? new Date(`${externalDateRaw}T12:00:00`) : null;

  const totalAmount = lines.reduce((s, l) => s + (l.price ?? 0) * l.qty, 0);
  const doc = await prisma.stockDocument.create({
    data: {
      number: await nextDocNumber(prefixes[type] ?? "D"),
      type,
      storeId,
      toStoreId: toStoreId === "__none__" ? null : toStoreId,
      supplierId: supplierId === "__none__" ? null : supplierId,
      userId: user.id,
      comment,
      externalNumber,
      externalDate: externalDate && !Number.isNaN(externalDate.getTime()) ? externalDate : null,
      totalAmount,
      lines: {
        create: lines.map((line) => ({
          productId: line.productId,
          qty: line.qty,
          price: line.price ?? 0,
          retailPrice: line.retailPrice ?? 0,
          warrantyDays: line.warrantyDays ?? null,
          serial: line.serial || null,
          qtyAccount: line.qtyAccount ?? 0,
          qtyActual: line.qtyActual ?? line.qty,
        })),
      },
    },
  });

  const autoPost = formData.get("autoPost") === "on" || formData.get("autoPost") === "1";
  if (autoPost) {
    await postStockDocument(doc.id, user.id);
    if (type === "receipt" && Number(formData.get("paidAmount") ?? 0) > 0) {
      const register = await ensureStoreCash(storeId);
      await postCashTxn({
        registerId: register.id,
        direction: "out",
        amount: Number(formData.get("paidAmount")),
        categoryName: "Оплата поставщику",
        stockDocId: doc.id,
        userId: user.id,
        note: doc.number,
      });
      await prisma.stockDocument.update({
        where: { id: doc.id },
        data: { paidAmount: Number(formData.get("paidAmount")) },
      });
    }
    if (type === "customer_return" && Number(formData.get("paidAmount") ?? 0) > 0) {
      const register = await ensureStoreCash(storeId);
      await postCashTxn({
        registerId: register.id,
        direction: "out",
        amount: Number(formData.get("paidAmount")),
        categoryName: "Возврат клиенту",
        stockDocId: doc.id,
        userId: user.id,
        note: doc.number,
      });
    }
  }

  revalidateStore(storeId);
  revalidatePath("/catalog/products");
  if (type === "receipt") {
    redirect(`/stores/${storeId}/receipts/${doc.id}`);
  }
  const paths: Partial<Record<StockDocType, string>> = {
    receipt: "receipts",
    transfer: "transfers",
    customer_return: "returns",
    supplier_return: "returns",
    inventory: "inventories",
    writeoff: "writeoffs",
  };
  redirect(`/stores/${storeId}/${paths[type] ?? "stock"}`);
}

/** Находит товар по id/коду/названию или создаёт новую номенклатуру. */
async function ensureProductForReceiptLine(input: {
  productId?: string | null;
  name?: string;
  code?: string;
  barcode?: string;
  purchasePrice: number;
  retailPrice: number;
  warrantyDays?: number;
  serialTracked: boolean;
}) {
  const barcode = (input.barcode ?? "").trim() || null;
  if (input.productId) {
    if (input.productId.startsWith("tmp-")) {
      // локальный черновик из UI — ищем/создаём по имени
    } else {
      const existing = await prisma.product.findUnique({ where: { id: input.productId } });
      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            ...(input.purchasePrice > 0 ? { purchasePrice: input.purchasePrice } : {}),
            ...(input.retailPrice > 0 ? { retailPrice: input.retailPrice } : {}),
            ...(input.warrantyDays != null ? { warrantyDays: input.warrantyDays } : {}),
            ...(barcode ? { barcode } : {}),
            ...(input.serialTracked ? { serialTracked: true } : {}),
          },
        });
        return existing.id;
      }
    }
  }

  const name = (input.name ?? "").trim();
  const codeRaw = (input.code ?? "").trim();
  if (!name && !codeRaw) throw new Error("Укажите название или код товара");

  if (codeRaw && codeRaw !== "новый") {
    const byCode = await prisma.product.findUnique({ where: { code: codeRaw } });
    if (byCode) {
      await prisma.product.update({
        where: { id: byCode.id },
        data: {
          ...(name ? { name } : {}),
          ...(input.purchasePrice > 0 ? { purchasePrice: input.purchasePrice } : {}),
          ...(input.retailPrice > 0 ? { retailPrice: input.retailPrice } : {}),
          ...(input.warrantyDays != null ? { warrantyDays: input.warrantyDays } : {}),
          ...(barcode ? { barcode } : {}),
          ...(input.serialTracked ? { serialTracked: true } : {}),
          active: true,
        },
      });
      return byCode.id;
    }
  }

  if (name) {
    const candidates = await prisma.product.findMany({
      where: { active: true },
      select: { id: true, name: true, purchasePrice: true, retailPrice: true },
      take: 5000,
    });
    const byName = candidates.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (byName) {
      await prisma.product.update({
        where: { id: byName.id },
        data: {
          ...(input.purchasePrice > 0 ? { purchasePrice: input.purchasePrice } : {}),
          ...(input.retailPrice > 0 ? { retailPrice: input.retailPrice } : {}),
          ...(input.warrantyDays != null ? { warrantyDays: input.warrantyDays } : {}),
          ...(barcode ? { barcode } : {}),
          ...(input.serialTracked ? { serialTracked: true } : {}),
          active: true,
        },
      });
      return byName.id;
    }
  }

  const count = await prisma.product.count();
  const code = codeRaw && codeRaw !== "новый" ? codeRaw : `N${String(count + 1).padStart(5, "0")}`;
  const created = await prisma.product.create({
    data: {
      code,
      name: name || code,
      barcode: barcode || (await nextProductBarcode(prisma, code)),
      purchasePrice: input.purchasePrice,
      retailPrice: input.retailPrice,
      warrantyDays: input.warrantyDays ?? 365,
      serialTracked: input.serialTracked,
      active: true,
    },
  });
  return created.id;
}

export async function postExistingStockDoc(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  const { user } = await loadStore(storeId);
  await postStockDocument(documentId, user.id);
  revalidateStore(storeId);
}

export async function createManualCashTxn(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const { user } = await loadStore(storeId);
  requirePerm(user, "cash.operate", storeId);
  const registerId = String(formData.get("registerId") ?? "");
  const direction = String(formData.get("direction") ?? "out") as "in" | "out";
  const amount = Number(formData.get("amount") ?? 0);
  const categoryName = String(formData.get("categoryName") ?? "").trim() || undefined;
  const note = String(formData.get("note") ?? "").trim() || undefined;
  const recipient = String(formData.get("recipient") ?? "").trim() || undefined;
  await postCashTxn({
    registerId,
    direction,
    amount,
    categoryName,
    userId: user.id,
    note,
    recipient,
  });
  await writeChangeLog({
    storeId,
    userId: user.id,
    entityType: "cash",
    entityId: registerId,
    action: direction,
    summary: `${user.name ?? "Сотрудник"} · касса ${direction === "in" ? "приход" : "расход"} ${amount} ₽${categoryName ? ` · ${categoryName}` : ""}${recipient ? ` · ${recipient}` : ""}`,
  });
  revalidateStore(storeId);
  revalidatePath(`/stores/${storeId}/audit`);
}

export async function createCashRegister(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const { user } = await loadStore(storeId);
  requirePerm(user, "cash.manageRegisters", storeId);
  const name = String(formData.get("name") ?? "").trim() || "Новая касса";
  await prisma.cashRegister.create({
    data: { storeId, name, balance: 0, active: true },
  });
  revalidateStore(storeId);
  redirect(`/stores/${storeId}/cash`);
}

export async function renameCashRegister(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const { user } = await loadStore(storeId);
  requirePerm(user, "cash.manageRegisters", storeId);
  const registerId = String(formData.get("registerId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const reg = await prisma.cashRegister.findUnique({ where: { id: registerId } });
  if (!reg || reg.storeId !== storeId) return;
  await prisma.cashRegister.update({ where: { id: registerId }, data: { name } });
  revalidateStore(storeId);
  redirect(`/stores/${storeId}/cash`);
}

/** Перемещение денег между кассами одной точки. */
export async function transferCashBetweenRegisters(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const { user } = await loadStore(storeId);
  requirePerm(user, "cash.operate", storeId);
  const fromId = String(formData.get("fromRegisterId") ?? "");
  const toId = String(formData.get("toRegisterId") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || undefined;
  if (!fromId || !toId || fromId === toId || amount <= 0) return;

  const [from, to] = await Promise.all([
    prisma.cashRegister.findUnique({ where: { id: fromId } }),
    prisma.cashRegister.findUnique({ where: { id: toId } }),
  ]);
  if (!from || !to || from.storeId !== storeId || to.storeId !== storeId) return;

  await postCashTxn({
    registerId: fromId,
    direction: "out",
    amount,
    categoryName: "Перемещение между кассами",
    userId: user.id,
    note: note ?? `→ ${to.name}`,
    recipient: to.name,
  });
  await postCashTxn({
    registerId: toId,
    direction: "in",
    amount,
    categoryName: "Перемещение между кассами",
    userId: user.id,
    note: note ?? `← ${from.name}`,
    recipient: from.name,
  });
  revalidateStore(storeId);
  redirect(`/stores/${storeId}/cash`);
}

export async function upsertCashCategory(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  await loadStore(storeId);
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const direction = String(formData.get("direction") ?? "out") as "in" | "out";
  if (!name) return;
  if (id) {
    const existing = await prisma.cashCategory.findUnique({ where: { id } });
    if (!existing || existing.system) return;
    await prisma.cashCategory.update({ where: { id }, data: { name, direction } });
  } else {
    await prisma.cashCategory.create({
      data: { name, direction, system: false },
    });
  }
  revalidateStore(storeId);
  redirect(`/stores/${storeId}/cash`);
}

export async function deleteCashCategory(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  await loadStore(storeId);
  const id = String(formData.get("id") ?? "");
  const cat = await prisma.cashCategory.findUnique({ where: { id } });
  if (!cat || cat.system) return;
  await prisma.cashCategory.delete({ where: { id } });
  revalidateStore(storeId);
  redirect(`/stores/${storeId}/cash`);
}

/** Начать инвентаризацию точки: черновик документа → продажи только этой точки блокируются. */
export async function startInventory(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const { user } = await loadStore(storeId);
  requirePerm(user, "inventory.create", storeId);

  const existing = await getOpenInventory(storeId);
  if (existing) {
    revalidateStore(storeId);
    redirect(`/stores/${storeId}/inventories`);
  }

  const doc = await prisma.stockDocument.create({
    data: {
      number: await nextDocNumber("I"),
      type: "inventory",
      storeId,
      userId: user.id,
      comment: "Инвентаризация в процессе",
      totalAmount: 0,
    },
  });
  await writeChangeLog({
    storeId,
    userId: user.id,
    entityType: "stock_document",
    entityId: doc.id,
    action: "inventory_start",
    summary: `Начата инвентаризация ${doc.number} — продажи точки приостановлены`,
    stockDocId: doc.id,
  });
  revalidateStore(storeId);
  redirect(`/stores/${storeId}/inventories`);
}

/** Отменить открытую инвентаризацию (черновик) — продажи снова доступны. */
export async function cancelInventory(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const documentId = String(formData.get("documentId") ?? "").trim();
  const { user } = await loadStore(storeId);
  requirePerm(user, "inventory.edit", storeId);

  const doc = await prisma.stockDocument.findFirst({
    where: {
      id: documentId || undefined,
      storeId,
      type: "inventory",
      postedAt: null,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!doc) {
    redirect(`/stores/${storeId}/inventories`);
  }

  await prisma.stockDocument.update({
    where: { id: doc.id },
    data: {
      deletedAt: new Date(),
      deletedById: user.id,
      deletedReason: "Отмена инвентаризации",
    },
  });
  await writeChangeLog({
    storeId,
    userId: user.id,
    entityType: "stock_document",
    entityId: doc.id,
    action: "inventory_cancel",
    summary: `Отменена инвентаризация ${doc.number} — продажи точки снова доступны`,
    stockDocId: doc.id,
  });
  revalidateStore(storeId);
  redirect(`/stores/${storeId}/inventories`);
}

export async function finishInventory(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const documentId = String(formData.get("documentId") ?? "").trim();
  const { user } = await loadStore(storeId);
  requirePerm(user, "inventory.edit", storeId);
  const payload = String(formData.get("payload") ?? "[]");
  const comment = String(formData.get("comment") ?? "").trim() || "Инвентаризация";
  let rows: Array<{
    productId: string;
    name: string;
    qtyAccount: number;
    qtyActual: number;
    price: number;
    retailPrice?: number;
    serial?: string;
  }> = [];
  try {
    rows = JSON.parse(payload);
  } catch {
    return;
  }
  if (!rows.length) return;

  let doc = documentId
    ? await prisma.stockDocument.findFirst({
        where: {
          id: documentId,
          storeId,
          type: "inventory",
          postedAt: null,
          deletedAt: null,
        },
      })
    : await getOpenInventory(storeId);

  if (!doc) {
    doc = await prisma.stockDocument.create({
      data: {
        number: await nextDocNumber("I"),
        type: "inventory",
        storeId,
        userId: user.id,
        comment,
        totalAmount: 0,
      },
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.stockLine.deleteMany({ where: { documentId: doc!.id } });
    await tx.stockLine.createMany({
      data: rows.map((r) => ({
        documentId: doc!.id,
        productId: r.productId,
        qty: Math.max(0, r.qtyActual),
        qtyAccount: r.qtyAccount,
        qtyActual: r.qtyActual,
        price: r.price,
        retailPrice: r.retailPrice ?? 0,
        serial: r.serial || null,
      })),
    });
    await tx.stockDocument.update({
      where: { id: doc!.id },
      data: { comment, userId: user.id },
    });
  });

  await postStockDocument(doc.id, user.id);
  await writeChangeLog({
    storeId,
    userId: user.id,
    entityType: "stock_document",
    entityId: doc.id,
    action: "inventory_finish",
    summary: `Инвентаризация ${doc.number}: позиций ${rows.length} — продажи точки снова доступны`,
    stockDocId: doc.id,
  });
  revalidateStore(storeId);
  redirect(`/stores/${storeId}/inventories?done=${doc.id}`);
}

/** Мягкое удаление складского документа (поступление и др.): сторно остатков/серий/кассы если проведён. */
export async function softDeleteStockDoc(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const { user } = await loadStore(storeId);

  const doc = await prisma.stockDocument.findUnique({
    where: { id: documentId },
    include: { lines: { include: { product: true } }, cashTxns: true },
  });
  if (!doc || doc.storeId !== storeId || doc.deletedAt) return;

  const deleteKey: Partial<Record<StockDocType, PermissionKey>> = {
    receipt: "receipts.delete",
    transfer: "transfers.delete",
    customer_return: "returns.delete",
    supplier_return: "returns.delete",
    inventory: "inventory.delete",
    writeoff: "writeoffs.delete",
  };
  const key = deleteKey[doc.type];
  if (key) requirePerm(user, key, storeId);

  if (doc.postedAt) {
    await prisma.$transaction(async (tx) => {
      for (const line of doc.lines) {
        switch (doc.type) {
          case "receipt":
          case "customer_return": {
            await applyBalance(tx, doc.storeId, line.productId, -line.qty);
            if (line.serial) {
              await tx.productSerial.updateMany({
                where: { productId: line.productId, serial: line.serial, storeId: doc.storeId },
                data: { status: "written_off" },
              });
            }
            break;
          }
          case "supplier_return":
          case "writeoff": {
            await applyBalance(tx, doc.storeId, line.productId, line.qty);
            if (line.serial) {
              await tx.productSerial.updateMany({
                where: { productId: line.productId, serial: line.serial },
                data: { status: "in_stock", storeId: doc.storeId },
              });
            }
            break;
          }
          case "transfer": {
            if (doc.toStoreId) {
              await applyBalance(tx, doc.toStoreId, line.productId, -line.qty);
              await applyBalance(tx, doc.storeId, line.productId, line.qty);
              if (line.serial) {
                await tx.productSerial.updateMany({
                  where: { productId: line.productId, serial: line.serial },
                  data: { storeId: doc.storeId, status: "in_stock" },
                });
              }
            }
            break;
          }
          case "inventory": {
            const delta = line.qtyActual - line.qtyAccount;
            if (delta !== 0) await applyBalance(tx, doc.storeId, line.productId, -delta);
            if (line.serial && line.qtyActual <= 0 && line.qtyAccount > 0) {
              await tx.productSerial.updateMany({
                where: { productId: line.productId, serial: line.serial, storeId: doc.storeId },
                data: { status: "in_stock" },
              });
            }
            break;
          }
          default:
            break;
        }
      }
    });

    if (doc.type === "receipt" && doc.paidAmount > 0) {
      const register = await ensureStoreCash(storeId);
      await postCashTxn({
        registerId: register.id,
        direction: "in",
        amount: doc.paidAmount,
        categoryName: "Сторно оплаты поставщику",
        stockDocId: doc.id,
        userId: user.id,
        note: `Удаление ${doc.number}`,
      });
    }
  }

  await prisma.stockDocument.update({
    where: { id: doc.id },
    data: {
      deletedAt: new Date(),
      deletedById: user.id,
      deletedReason: reason,
    },
  });
  await writeChangeLog({
    storeId,
    userId: user.id,
    entityType: "stock_document",
    entityId: doc.id,
    action: "soft_delete",
    summary: `Документ ${doc.number} помечен удалённым${reason ? `: ${reason}` : ""}`,
    stockDocId: doc.id,
    meta: { type: doc.type, reason },
  });

  revalidateStore(storeId);
  const back =
    doc.type === "receipt"
      ? `/stores/${storeId}/receipts/${doc.id}`
      : doc.type === "inventory"
        ? `/stores/${storeId}/inventories`
        : `/stores/${storeId}/receipts`;
  redirect(back);
}

export async function createOrder(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const { user } = await loadStore(storeId);
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const customerName = String(formData.get("customerName") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim() || null;
  const prepaidAmount = Number(formData.get("prepaidAmount") ?? 0);
  const kindRaw = String(formData.get("kind") ?? "stock_reserve");
  const kind = kindRaw === "procurement" ? "procurement" : "stock_reserve";
  const dueRaw = String(formData.get("dueAt") ?? "").trim();
  const dueAt = dueRaw ? new Date(`${dueRaw}T12:00:00`) : null;
  const statusRaw = String(formData.get("status") ?? "");
  const payload = String(formData.get("payload") ?? "[]");
  let lines: Array<{ productId: string | null; name: string; qty: number; unitPrice: number }> = [];
  try {
    lines = JSON.parse(payload);
  } catch {
    return;
  }
  if (!lines.length) return;

  let customerId: string | null = null;
  if (phone) {
    const customer = await prisma.customer.upsert({
      where: { storeId_phone: { storeId, phone } },
      update: { name: customerName || undefined },
      create: { storeId, name: customerName || "Клиент", phone },
    });
    customerId = customer.id;
  }

  const mapped = lines.map((l) => ({
    ...l,
    productId: l.productId || null,
    lineTotal: l.unitPrice * l.qty,
  }));
  const totalAmount = mapped.reduce((s, l) => s + l.lineTotal, 0);

  const procurementStatus =
    statusRaw === "in_transit" ||
    statusRaw === "arrived" ||
    statusRaw === "purchased" ||
    statusRaw === "accepted"
      ? statusRaw
      : "accepted";

  const order = await prisma.$transaction(async (tx) => {
    if (kind === "stock_reserve") {
      for (const line of mapped) {
        if (!line.productId) throw new Error("Для резерва нужна позиция из каталога");
        await applyBalance(tx, storeId, line.productId, -line.qty);
      }
    }
    return tx.order.create({
      data: {
        number: await nextOrderNumber(),
        storeId,
        customerId,
        userId: user.id,
        kind,
        status: kind === "stock_reserve" ? "reserved" : procurementStatus,
        totalAmount,
        prepaidAmount: Math.max(0, prepaidAmount),
        comment,
        dueAt: kind === "procurement" && dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null,
        lines: {
          create: mapped.map((l) => ({
            productId: l.productId || null,
            name: l.name,
            qty: l.qty,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
          })),
        },
      },
    });
  });

  if (prepaidAmount > 0) {
    const register = await ensureStoreCash(storeId);
    await postCashTxn({
      registerId: register.id,
      direction: "in",
      amount: prepaidAmount,
      categoryName: "Предоплата заказа",
      userId: user.id,
      note: order.number,
    });
  }

  revalidateStore(storeId);
  redirect(`/stores/${storeId}/orders`);
}

export async function updateOrderStatus(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "");
  await loadStore(storeId);
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.storeId !== storeId || order.kind !== "procurement") return;
  if (!["accepted", "purchased", "in_transit", "arrived"].includes(status)) return;
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: status as "accepted" | "purchased" | "in_transit" | "arrived",
      issuedAt: status === "arrived" ? new Date() : order.issuedAt,
    },
  });
  revalidateStore(storeId);
}

export async function issueOrder(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  const { user } = await loadStore(storeId);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });
  if (!order || order.storeId !== storeId || order.status !== "reserved") return;

  const productIds = order.lines.map((l) => l.productId).filter(Boolean) as string[];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, purchasePrice: true, warrantyDays: true },
  });
  const productMeta = new Map(products.map((p) => [p.id, p]));
  const saleNumber = await nextSaleNumber();

  const sale = await prisma.$transaction(async (tx) => {
    for (const line of order.lines) {
      if (line.serial && line.productId) {
        await tx.productSerial.updateMany({
          where: { productId: line.productId, serial: line.serial },
          data: { status: "sold" },
        });
      }
    }
    await tx.order.update({
      where: { id: orderId },
      data: { status: "issued", issuedAt: new Date() },
    });
    return tx.sale.create({
      data: {
        storeId,
        customerId: order.customerId,
        sellerUserId: user.id,
        amount: order.totalAmount,
        creditAmount: 0,
        discountTotal: 0,
        note: `Выдача заказа ${order.number}`,
        number: saleNumber,
        lines: {
          create: order.lines.map((line) => {
            const meta = line.productId ? productMeta.get(line.productId) : null;
            return {
              productId: line.productId,
              name: line.name,
              qty: line.qty,
              unitPrice: line.unitPrice,
              costPrice: meta?.purchasePrice ?? 0,
              discountType: "none" as const,
              discountValue: 0,
              lineTotal: line.lineTotal,
              serial: line.serial,
              warrantyDays: meta?.warrantyDays ?? null,
            };
          }),
        },
      },
    });
  });

  const rest = order.totalAmount - order.prepaidAmount;
  if (rest > 0) {
    const register = await ensureStoreCash(storeId);
    await postCashTxn({
      registerId: register.id,
      direction: "in",
      amount: rest,
      categoryName: "Продажа",
      saleId: sale.id,
      userId: user.id,
      note: `Выдача ${order.number}`,
    });
  }

  revalidateStore(storeId);
}

export async function cancelOrder(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  await loadStore(storeId);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });
  if (!order || order.storeId !== storeId || order.status !== "reserved") return;

  await prisma.$transaction(async (tx) => {
    for (const line of order.lines) {
      if (!line.productId) continue;
      await applyBalance(tx, storeId, line.productId, line.qty);
      if (line.serial) {
        await tx.productSerial.updateMany({
          where: { productId: line.productId, serial: line.serial },
          data: { status: "in_stock" },
        });
      }
    }
    await tx.order.update({ where: { id: orderId }, data: { status: "cancelled" } });
  });

  revalidateStore(storeId);
}

export async function payCommission(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const { user } = await loadStore(storeId);
  requirePerm(user, "payroll.pay", storeId);
  const amount = Number(formData.get("amount") ?? 0);
  const recipient = String(formData.get("recipient") ?? "").trim();
  if (amount <= 0 || !recipient) return;
  const register = await ensureStoreCash(storeId);
  // ensure salary category
  await prisma.cashCategory.findFirst({ where: { name: "Зарплата", direction: "out" } }).then(async (c) => {
    if (!c) {
      await prisma.cashCategory.create({ data: { name: "Зарплата", direction: "out", system: true } });
    }
  });
  await postCashTxn({
    registerId: register.id,
    direction: "out",
    amount,
    categoryName: "Зарплата",
    userId: user.id,
    recipient,
    note: `Зарплата · ${recipient}`,
  });
  await writeChangeLog({
    storeId,
    userId: user.id,
    entityType: "payroll",
    entityId: storeId,
    action: "pay",
    summary: `${user.name ?? "Сотрудник"} выплатил зарплату ${recipient}: ${amount} ₽`,
  });
  revalidateStore(storeId);
  revalidatePath(`/stores/${storeId}/payroll`);
  revalidatePath(`/stores/${storeId}/schedule`);
  revalidatePath(`/stores/${storeId}/audit`);
}

export async function updateStaffPay(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const { user } = await loadStore(storeId);
  requirePerm(user, "payroll.settings", storeId);
  const userId = String(formData.get("userId") ?? "");
  const commissionPct = Number(String(formData.get("commissionPct") ?? "").replace(",", "."));
  const shiftPay = Number(formData.get("shiftPay") ?? 0);
  const staff = await prisma.user.findUnique({ where: { id: userId } });
  if (!staff || staff.storeId !== storeId) return;
  await prisma.user.update({
    where: { id: userId },
    data: {
      commissionPct: Number.isFinite(commissionPct) ? commissionPct : 0,
      shiftPay: Number.isFinite(shiftPay) ? Math.max(0, Math.round(shiftPay)) : 0,
    },
  });
  revalidateStore(storeId);
  revalidatePath(`/stores/${storeId}/payroll`);
  revalidatePath(`/stores/${storeId}/schedule`);
  redirect(`/stores/${storeId}/payroll`);
}

export async function upsertWorkShift(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const { user } = await loadStore(storeId);
  requirePerm(user, "schedule.manage", storeId);
  const id = String(formData.get("id") ?? "").trim();
  const userId = String(formData.get("userId") ?? "");
  const dateRaw = String(formData.get("date") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "10:00").trim() || "10:00";
  const endTime = String(formData.get("endTime") ?? "20:00").trim() || "20:00";
  const note = String(formData.get("note") ?? "").trim() || null;
  const shiftPayRaw = String(formData.get("shiftPay") ?? "").trim();
  const shiftPay = shiftPayRaw === "" ? null : Math.max(0, Math.round(Number(shiftPayRaw) || 0));
  const month = String(formData.get("month") ?? "").trim();
  if (!userId || !dateRaw) return;

  const staff = await prisma.user.findUnique({ where: { id: userId } });
  if (!staff || (staff.storeId !== storeId && staff.role !== "partner")) return;

  const date = new Date(`${dateRaw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return;

  const payLabel = shiftPay ?? staff.shiftPay ?? 0;
  let action: "create" | "update" = "create";
  let shiftId = id;

  if (id) {
    const existing = await prisma.workShift.findUnique({ where: { id } });
    if (!existing || existing.storeId !== storeId || existing.deletedAt) return;
    await prisma.workShift.update({
      where: { id },
      data: { userId, date, startTime, endTime, note, shiftPay },
    });
    action = "update";
  } else {
    const row = await prisma.workShift.upsert({
      where: { storeId_userId_date: { storeId, userId, date } },
      create: { storeId, userId, date, startTime, endTime, note, shiftPay },
      update: { startTime, endTime, note, shiftPay, deletedAt: null },
    });
    shiftId = row.id;
    action = "create";
  }

  await writeChangeLog({
    storeId,
    userId: user.id,
    entityType: "work_shift",
    entityId: shiftId,
    action,
    summary:
      action === "update"
        ? `${user.name ?? "Админ"} изменил смену ${staff.name} · ${dateRaw} · ${startTime}–${endTime} · ${payLabel} ₽`
        : `${user.name ?? "Админ"} поставил в график ${staff.name} · ${dateRaw} · ${startTime}–${endTime} · ${payLabel} ₽`,
    meta: { staffId: userId, date: dateRaw, startTime, endTime, shiftPay: payLabel },
  });

  revalidateStore(storeId);
  revalidatePath(`/stores/${storeId}/schedule`);
  revalidatePath(`/stores/${storeId}/payroll`);
  revalidatePath(`/stores/${storeId}/audit`);
  const q = month ? `?month=${month}` : "";
  redirect(`/stores/${storeId}/schedule${q}`);
}

export async function deleteWorkShift(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const { user } = await loadStore(storeId);
  requirePerm(user, "schedule.manage", storeId);
  const id = String(formData.get("id") ?? "");
  const month = String(formData.get("month") ?? "").trim();
  const row = await prisma.workShift.findUnique({ where: { id }, include: { user: true } });
  if (!row || row.storeId !== storeId || row.deletedAt) return;
  await prisma.workShift.update({ where: { id }, data: { deletedAt: new Date() } });
  const dateRaw = row.date.toISOString().slice(0, 10);
  await writeChangeLog({
    storeId,
    userId: user.id,
    entityType: "work_shift",
    entityId: id,
    action: "delete",
    summary: `${user.name ?? "Админ"} убрал смену ${row.user.name} · ${dateRaw} · ${row.startTime}–${row.endTime} (сохранено в истории)`,
  });
  revalidateStore(storeId);
  revalidatePath(`/stores/${storeId}/schedule`);
  revalidatePath(`/stores/${storeId}/payroll`);
  revalidatePath(`/stores/${storeId}/audit`);
  const q = month ? `?month=${month}` : "";
  redirect(`/stores/${storeId}/schedule${q}`);
}

export async function importProductsCsv(formData: FormData) {
  const user = await requireUser();
  if (!isUk(user.role)) redirect("/");
  const text = String(formData.get("csv") ?? "");
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return;
  const header = lines[0].split(";").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  for (const row of lines.slice(1)) {
    const cols = row.split(";");
    const code = cols[idx("code")]?.trim();
    const name = cols[idx("name")]?.trim();
    if (!code || !name) continue;
    await prisma.product.upsert({
      where: { code },
      update: {
        name,
        retailPrice: Number(cols[idx("retail")] ?? 0) || 0,
        purchasePrice: Number(cols[idx("purchase")] ?? 0) || 0,
        serialTracked: (cols[idx("serial")] ?? "").trim() === "1",
      },
      create: {
        code,
        name,
        barcode: cols[idx("barcode")]?.trim() || (await nextProductBarcode(prisma, code)),
        retailPrice: Number(cols[idx("retail")] ?? 0) || 0,
        purchasePrice: Number(cols[idx("purchase")] ?? 0) || 0,
        serialTracked: (cols[idx("serial")] ?? "").trim() === "1",
      },
    });
  }
  revalidatePath("/catalog/products");
  revalidatePath("/settings/import");
}

export async function importStockCsv(formData: FormData) {
  const user = await requireUser();
  if (!isUk(user.role)) redirect("/");
  const storeId = String(formData.get("storeId") ?? "");
  const text = String(formData.get("csv") ?? "");
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2 || !storeId) return;
  const header = lines[0].split(";").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const docLines: Array<{ productId: string; qty: number; qtyAccount: number; qtyActual: number }> = [];
  for (const row of lines.slice(1)) {
    const cols = row.split(";");
    const code = cols[idx("code")]?.trim();
    const qty = Number(cols[idx("qty")] ?? 0);
    if (!code || Number.isNaN(qty)) continue;
    const product = await prisma.product.findUnique({ where: { code } });
    if (!product) continue;
    const bal = await prisma.stockBalance.findUnique({
      where: { storeId_productId: { storeId, productId: product.id } },
    });
    const account = bal?.qty ?? 0;
    docLines.push({
      productId: product.id,
      qty: qty - account,
      qtyAccount: account,
      qtyActual: qty,
    });
  }
  if (!docLines.length) return;

  const doc = await prisma.stockDocument.create({
    data: {
      number: await nextDocNumber("I"),
      type: "inventory",
      storeId,
      userId: user.id,
      comment: "Импорт CSV остатков",
      lines: {
        create: docLines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          qtyAccount: l.qtyAccount,
          qtyActual: l.qtyActual,
          price: 0,
        })),
      },
    },
  });
  await postStockDocument(doc.id, user.id);
  revalidateStore(storeId);
  revalidatePath("/settings/import");
}

export async function importCustomersCsv(formData: FormData) {
  const user = await requireUser();
  if (!isUk(user.role)) redirect("/");
  const storeId = String(formData.get("storeId") ?? "");
  const text = String(formData.get("csv") ?? "");
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2 || !storeId) return;
  const header = lines[0].split(";").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  for (const row of lines.slice(1)) {
    const cols = row.split(";");
    const name = cols[idx("name")]?.trim();
    const phone = cols[idx("phone")]?.trim();
    if (!name || !phone) continue;
    const notes = cols[idx("notes")]?.trim() || null;
    await prisma.customer.upsert({
      where: { storeId_phone: { storeId, phone } },
      update: { name, notes },
      create: { storeId, name, phone, notes },
    });
  }
  revalidateStore(storeId);
  revalidatePath("/settings/import");
}

export async function createCustomer(formData: FormData) {
  const user = await requireUser();
  const storeId = String(formData.get("storeId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!storeId || !name || !phone) return;

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store || !assertStoreAccess(user, store)) return;

  await prisma.customer.upsert({
    where: { storeId_phone: { storeId, phone } },
    update: { name, notes },
    create: { storeId, name, phone, notes },
  });
  revalidateStore(storeId);
}

/** Правка устройства: название номенклатуры, гарантия, IMEI, цены, заметка. Все изменения в журнал. */
export async function updateDevice(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const serialId = String(formData.get("serialId") ?? "");
  const { user } = await loadStore(storeId);
  const row = await prisma.productSerial.findUnique({
    where: { id: serialId },
    include: { product: true },
  });
  if (!row || row.storeId !== storeId) return;

  const name = String(formData.get("name") ?? "").trim();
  const newSerial = String(formData.get("serial") ?? "").trim();
  const warrantyDays = Number(formData.get("warrantyDays") ?? row.warrantyDays ?? row.product.warrantyDays);
  const purchasePrice = Number(formData.get("purchasePrice") ?? row.purchasePrice ?? row.product.purchasePrice);
  const retailPrice = Number(formData.get("retailPrice") ?? row.retailPrice ?? row.product.retailPrice);
  const note = String(formData.get("note") ?? "").trim() || null;

  await prisma.$transaction(async (tx) => {
    if (name && name !== row.product.name) {
      await tx.product.update({ where: { id: row.productId }, data: { name } });
      await writeChangeLog(
        {
          storeId,
          userId: user.id,
          entityType: "product",
          entityId: row.productId,
          action: "edit",
          field: "name",
          oldValue: row.product.name,
          newValue: name,
          summary: `Номенклатура: «${row.product.name}» → «${name}»`,
          productId: row.productId,
          serialId: row.id,
        },
        tx,
      );
    }

    if (newSerial && newSerial !== row.serial) {
      const clash = await tx.productSerial.findFirst({
        where: { productId: row.productId, serial: newSerial, NOT: { id: row.id } },
      });
      if (clash) throw new Error("Такой IMEI уже есть у этой модели");
      await tx.productSerial.update({ where: { id: row.id }, data: { serial: newSerial } });
      await writeChangeLog(
        {
          storeId,
          userId: user.id,
          entityType: "serial",
          entityId: row.id,
          action: "imei_change",
          field: "serial",
          oldValue: row.serial,
          newValue: newSerial,
          summary: `IMEI изменён: ${row.serial} → ${newSerial}`,
          productId: row.productId,
          serialId: row.id,
          serialOld: row.serial,
          serialNew: newSerial,
        },
        tx,
      );
    }

    const prevW = row.warrantyDays ?? row.product.warrantyDays;
    if (Number.isFinite(warrantyDays) && warrantyDays !== prevW) {
      await tx.productSerial.update({ where: { id: row.id }, data: { warrantyDays } });
      await tx.product.update({ where: { id: row.productId }, data: { warrantyDays } });
      await writeChangeLog(
        {
          storeId,
          userId: user.id,
          entityType: "serial",
          entityId: row.id,
          action: "warranty_change",
          field: "warrantyDays",
          oldValue: String(prevW),
          newValue: String(warrantyDays),
          summary: `Гарантия: ${prevW} → ${warrantyDays} дн.`,
          productId: row.productId,
          serialId: row.id,
          serialNew: newSerial || row.serial,
        },
        tx,
      );
    }

    const prevP = row.purchasePrice ?? row.product.purchasePrice;
    const prevR = row.retailPrice ?? row.product.retailPrice;
    if (purchasePrice !== prevP || retailPrice !== prevR) {
      await tx.productSerial.update({
        where: { id: row.id },
        data: { purchasePrice, retailPrice },
      });
      await tx.product.update({
        where: { id: row.productId },
        data: { purchasePrice, retailPrice },
      });
      await writeChangeLog(
        {
          storeId,
          userId: user.id,
          entityType: "serial",
          entityId: row.id,
          action: "price_change",
          summary: `Цены: закуп ${prevP}→${purchasePrice}, розн ${prevR}→${retailPrice}`,
          productId: row.productId,
          serialId: row.id,
          serialNew: newSerial || row.serial,
          meta: { purchasePrice, retailPrice, prevP, prevR },
        },
        tx,
      );
    }

    if (note !== (row.note ?? null)) {
      await tx.productSerial.update({ where: { id: row.id }, data: { note } });
      await writeChangeLog(
        {
          storeId,
          userId: user.id,
          entityType: "serial",
          entityId: row.id,
          action: "note",
          field: "note",
          oldValue: row.note,
          newValue: note,
          summary: note ? `Справка/заметка: ${note}` : "Заметка очищена",
          productId: row.productId,
          serialId: row.id,
          serialNew: newSerial || row.serial,
        },
        tx,
      );
    }
  });

  revalidateStore(storeId);
  revalidatePath(`/stores/${storeId}/devices/${serialId}`);
  revalidatePath(`/catalog/products/${row.productId}`);
  redirect(`/stores/${storeId}/devices/${serialId}`);
}

/** Мягкое удаление чека: скрыт из обычных списков, остаётся в истории. Остаток и касса откатываются. */
export async function softDeleteSale(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const saleId = String(formData.get("saleId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const { user } = await loadStore(storeId);
  requirePerm(user, "sales.delete", storeId);

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { lines: true, cashTxns: true },
  });
  if (!sale || sale.storeId !== storeId || sale.deletedAt) return;

  await prisma.$transaction(async (tx) => {
    for (const line of sale.lines) {
      if (line.deletedAt) continue;
      if (line.productId) {
        await applyBalance(tx, storeId, line.productId, line.qty);
      }
      if (line.serial && line.productId) {
        const ser = await tx.productSerial.findFirst({
          where: { productId: line.productId, storeId, serial: line.serial },
        });
        if (ser && ser.status === "sold") {
          await tx.productSerial.update({ where: { id: ser.id }, data: { status: "in_stock" } });
        }
      }
      if (!line.deletedAt) {
        await tx.saleLine.update({
          where: { id: line.id },
          data: { deletedAt: new Date(), deletedById: user.id },
        });
      }
    }

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        deletedAt: new Date(),
        deletedById: user.id,
        deletedReason: reason,
      },
    });

    await writeChangeLog(
      {
        storeId,
        userId: user.id,
        entityType: "sale",
        entityId: sale.id,
        action: "soft_delete",
        summary: `Чек ${sale.number ?? sale.id.slice(0, 8)} помечен удалённым${reason ? `: ${reason}` : ""}`,
        saleId: sale.id,
        meta: { amount: sale.amount, reason },
      },
      tx,
    );
  });

  const cashIn = sale.amount - sale.creditAmount;
  if (cashIn > 0) {
    const register = await ensureStoreCash(storeId);
    await postCashTxn({
      registerId: register.id,
      direction: "out",
      amount: cashIn,
      categoryName: "Сторно продажи",
      saleId: sale.id,
      userId: user.id,
      note: `Удаление чека ${sale.number ?? sale.id.slice(0, 8)}`,
    });
  }

  revalidateStore(storeId);
  revalidatePath(`/stores/${storeId}/sales/${saleId}`);
  revalidatePath(`/stores/${storeId}/sales`);
  revalidatePath(`/stores/${storeId}/pos`);
  revalidatePath(`/stores/${storeId}/reports`);
  redirect(`/stores/${storeId}/sales/${saleId}`);
}

/** Мягкое удаление позиции в чеке — позиция с красным ×, чек остаётся. */
export async function softDeleteSaleLine(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const lineId = String(formData.get("lineId") ?? "");
  const { user } = await loadStore(storeId);
  requirePerm(user, "sales.delete", storeId);

  const line = await prisma.saleLine.findUnique({
    where: { id: lineId },
    include: { sale: true },
  });
  if (!line || line.sale.storeId !== storeId || line.deletedAt || line.sale.deletedAt) return;

  await prisma.$transaction(async (tx) => {
    if (line.productId) {
      await applyBalance(tx, storeId, line.productId, line.qty);
    }
    if (line.serial && line.productId) {
      const ser = await tx.productSerial.findFirst({
        where: { productId: line.productId, storeId, serial: line.serial },
      });
      if (ser && ser.status === "sold") {
        await tx.productSerial.update({ where: { id: ser.id }, data: { status: "in_stock" } });
      }
    }

    await tx.saleLine.update({
      where: { id: line.id },
      data: { deletedAt: new Date(), deletedById: user.id },
    });

    const activeLines = await tx.saleLine.findMany({
      where: { saleId: line.saleId, deletedAt: null },
    });
    const newAmount = activeLines.reduce((s, l) => s + l.lineTotal, 0);
    await tx.sale.update({
      where: { id: line.saleId },
      data: { amount: newAmount },
    });

    await writeChangeLog(
      {
        storeId,
        userId: user.id,
        entityType: "sale_line",
        entityId: line.id,
        action: "soft_delete",
        summary: `Позиция удалена из чека ${line.sale.number ?? line.saleId.slice(0, 8)}: ${line.name}${line.serial ? ` · ${line.serial}` : ""}`,
        productId: line.productId,
        serialNew: line.serial,
        saleId: line.saleId,
        meta: { lineTotal: line.lineTotal, prevAmount: line.sale.amount, newAmount },
      },
      tx,
    );
  });

  if (line.lineTotal > 0) {
    const register = await ensureStoreCash(storeId);
    await postCashTxn({
      registerId: register.id,
      direction: "out",
      amount: line.lineTotal,
      categoryName: "Сторно продажи",
      saleId: line.saleId,
      userId: user.id,
      note: `Удаление позиции: ${line.name}`,
    });
  }

  revalidateStore(storeId);
  revalidatePath(`/stores/${storeId}/sales/${line.saleId}`);
  redirect(`/stores/${storeId}/sales/${line.saleId}`);
}

/** Мягкое удаление номенклатуры с остатков — скрыта, но видна в истории. */
export async function softDeleteProduct(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "").trim();
  const productId = String(formData.get("productId") ?? "");
  const user = await requireUser();
  if (!canEditCatalog(user.role)) {
    if (storeId) redirect(`/stores/${storeId}/stock`);
    redirect("/catalog/products");
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.deletedAt) return;

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: { deletedAt: new Date(), deletedById: user.id, active: false },
    });
    await writeChangeLog(
      {
        storeId: storeId || null,
        userId: user.id,
        entityType: "product",
        entityId: productId,
        action: "soft_delete",
        summary: `Номенклатура «${product.name}» помечена удалённой`,
        productId,
      },
      tx,
    );
  });

  revalidatePath("/catalog/products");
  revalidatePath(`/catalog/products/${productId}`);
  if (storeId) {
    revalidateStore(storeId);
    redirect(`/stores/${storeId}/stock?deleted=1`);
  }
  redirect(`/catalog/products/${productId}`);
}
