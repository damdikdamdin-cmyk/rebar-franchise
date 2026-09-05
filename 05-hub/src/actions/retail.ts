"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { DiscountType, StockDocType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { assertStoreAccess, isUk } from "@/lib/access";
import { applyBalance, lineTotal, nextDocNumber, nextOrderNumber, nextSaleNumber, postStockDocument } from "@/lib/stock";
import { ensureStoreCash, postCashTxn } from "@/lib/cash";

async function loadStore(storeId: string) {
  const user = await requireUser();
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store || !assertStoreAccess(user, store)) redirect("/");
  return { user, store };
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
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const data = {
    code: String(formData.get("code") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    barcode: String(formData.get("barcode") ?? "").trim() || null,
    sku: String(formData.get("sku") ?? "").trim() || null,
    groupId: String(formData.get("groupId") ?? "") || null,
    supplierId: String(formData.get("supplierId") ?? "") || null,
    unit: String(formData.get("unit") ?? "шт") || "шт",
    warrantyDays: Number(formData.get("warrantyDays") ?? 365),
    serialTracked: formData.get("serialTracked") === "on",
    purchasePrice: Number(formData.get("purchasePrice") ?? 0),
    retailPrice: Number(formData.get("retailPrice") ?? 0),
    repairPrice: Number(formData.get("repairPrice") ?? 0),
    preorderPrice: Number(formData.get("preorderPrice") ?? 0),
    minStock: Number(formData.get("minStock") ?? 0),
    commissionPct: Number(formData.get("commissionPct") ?? 0),
    commissionRub: Number(formData.get("commissionRub") ?? 0),
    description: String(formData.get("description") ?? "").trim() || null,
    active: formData.get("active") !== "off",
  };
  if (!data.code || !data.name) return;
  if (data.groupId === "__none__") data.groupId = null;
  if (data.supplierId === "__none__") data.supplierId = null;

  if (id) {
    await prisma.product.update({ where: { id }, data });
    revalidatePath("/catalog/products");
    revalidatePath(`/catalog/products/${id}`);
    redirect(`/catalog/products/${id}`);
  }
  const product = await prisma.product.create({ data });
  revalidatePath("/catalog/products");
  redirect(`/catalog/products/${product.id}`);
}

export async function createProductGroup(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.productGroup.create({ data: { name } });
  revalidatePath("/catalog/products");
}

export async function createSupplier(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  if (!name) return;
  await prisma.supplier.create({ data: { name, phone } });
  revalidatePath("/catalog/products");
}

export async function completeSale(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const { user } = await loadStore(storeId);
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

  const phone = String(formData.get("phone") ?? "").trim();
  const customerName = String(formData.get("customerName") ?? "").trim();
  const creditAmount = Number(formData.get("creditAmount") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;

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
    lineTotal: lineTotal(line.unitPrice, line.qty, line.discountType, line.discountValue),
  }));
  const amount = computed.reduce((s, l) => s + l.lineTotal, 0);
  const discountTotal = computed.reduce(
    (s, l) => s + (l.unitPrice * l.qty - l.lineTotal),
    0,
  );

  const number = await nextSaleNumber();
  const sale = await prisma.$transaction(async (tx) => {
    for (const line of computed) {
      await applyBalance(tx, storeId, line.productId, -line.qty);
      if (line.serial) {
        await tx.productSerial.updateMany({
          where: { productId: line.productId, serial: line.serial },
          data: { status: "sold" },
        });
      }
    }
    return tx.sale.create({
      data: {
        storeId,
        customerId,
        sellerUserId: user.id,
        amount,
        creditAmount: Math.max(0, Math.round(creditAmount)),
        discountTotal,
        note,
        number,
        lines: {
          create: computed.map((line) => ({
            productId: line.productId,
            name: line.name,
            qty: line.qty,
            unitPrice: line.unitPrice,
            discountType: line.discountType,
            discountValue: line.discountValue,
            lineTotal: line.lineTotal,
            serial: line.serial || null,
          })),
        },
      },
    });
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
  redirect(`/stores/${storeId}/pos?sold=${sale.id}`);
}

export async function createStockDoc(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const type = String(formData.get("type") ?? "") as StockDocType;
  const { user } = await loadStore(storeId);
  const comment = String(formData.get("comment") ?? "").trim() || null;
  const toStoreId = String(formData.get("toStoreId") ?? "") || null;
  const supplierId = String(formData.get("supplierId") ?? "") || null;
  const payload = String(formData.get("payload") ?? "[]");
  let lines: Array<{
    productId: string;
    qty: number;
    price?: number;
    serial?: string;
    qtyAccount?: number;
    qtyActual?: number;
  }> = [];
  try {
    lines = JSON.parse(payload);
  } catch {
    return;
  }
  if (!lines.length) return;

  const prefixes: Record<StockDocType, string> = {
    receipt: "C",
    transfer: "T",
    customer_return: "F",
    supplier_return: "R",
    inventory: "I",
    writeoff: "W",
  };

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
      totalAmount,
      lines: {
        create: lines.map((line) => ({
          productId: line.productId,
          qty: line.qty,
          price: line.price ?? 0,
          serial: line.serial || null,
          qtyAccount: line.qtyAccount ?? 0,
          qtyActual: line.qtyActual ?? line.qty,
        })),
      },
    },
  });

  const autoPost = formData.get("autoPost") === "on" || formData.get("autoPost") === "1";
  if (autoPost) {
    await postStockDocument(doc.id);
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

export async function postExistingStockDoc(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  await loadStore(storeId);
  await postStockDocument(documentId);
  revalidateStore(storeId);
}

export async function createManualCashTxn(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const { user } = await loadStore(storeId);
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
  revalidateStore(storeId);
}

export async function createOrder(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const { user } = await loadStore(storeId);
  const phone = String(formData.get("phone") ?? "").trim();
  const customerName = String(formData.get("customerName") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim() || null;
  const prepaidAmount = Number(formData.get("prepaidAmount") ?? 0);
  const payload = String(formData.get("payload") ?? "[]");
  let lines: Array<{ productId: string; name: string; qty: number; unitPrice: number }> = [];
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

  const mapped = lines.map((l) => ({ ...l, lineTotal: l.unitPrice * l.qty }));
  const totalAmount = mapped.reduce((s, l) => s + l.lineTotal, 0);

  const order = await prisma.$transaction(async (tx) => {
    for (const line of mapped) {
      // reserve: move serials to reserved if provided; stock stays until issue
      await applyBalance(tx, storeId, line.productId, 0);
    }
    return tx.order.create({
      data: {
        number: await nextOrderNumber(),
        storeId,
        customerId,
        userId: user.id,
        status: "reserved",
        totalAmount,
        prepaidAmount: Math.max(0, prepaidAmount),
        comment,
        lines: {
          create: mapped.map((l) => ({
            productId: l.productId,
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

export async function issueOrder(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  const { user } = await loadStore(storeId);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });
  if (!order || order.storeId !== storeId || order.status !== "reserved") return;

  await prisma.$transaction(async (tx) => {
    for (const line of order.lines) {
      if (!line.productId) continue;
      await applyBalance(tx, storeId, line.productId, -line.qty);
    }
    await tx.order.update({
      where: { id: orderId },
      data: { status: "issued", issuedAt: new Date() },
    });
    const rest = order.totalAmount - order.prepaidAmount;
    if (rest > 0) {
      // cash posted outside tx below
    }
  });

  const rest = order.totalAmount - order.prepaidAmount;
  if (rest > 0) {
    const register = await ensureStoreCash(storeId);
    await postCashTxn({
      registerId: register.id,
      direction: "in",
      amount: rest,
      categoryName: "Продажа",
      userId: user.id,
      note: `Выдача ${order.number}`,
    });
  }

  revalidateStore(storeId);
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

  for (const row of lines.slice(1)) {
    const cols = row.split(";");
    const code = cols[idx("code")]?.trim();
    const qty = Number(cols[idx("qty")] ?? 0);
    if (!code || !qty) continue;
    const product = await prisma.product.findUnique({ where: { code } });
    if (!product) continue;
    await prisma.stockBalance.upsert({
      where: { storeId_productId: { storeId, productId: product.id } },
      update: { qty },
      create: { storeId, productId: product.id, qty },
    });
  }
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
