/**
 * E2E операционный прогон: поступление → перемещение → продажа → касса → инвентаризация.
 * node ./node_modules/tsx/dist/cli.mjs scripts/e2e-ops.ts
 */
import { PrismaClient } from "@prisma/client";
import { postStockDocument, applyBalance, nextDocNumber, nextSaleNumber, lineTotal } from "../src/lib/stock";
import { ensureStoreCash, ensureCashCategories, postCashTxn } from "../src/lib/cash";
import { writeChangeLog } from "../src/lib/audit";
import { nextProductBarcode } from "../src/lib/barcode";

const prisma = new PrismaClient();
const log: Array<{ step: string; ok: boolean; detail: string }> = [];

function randImei() {
  let s = "35";
  for (let i = 0; i < 13; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function step(name: string, ok: boolean, detail = "") {
  log.push({ step: name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const irk = await prisma.store.findFirst({ where: { city: "Иркутск" } });
  const ulan = await prisma.store.findFirst({ where: { city: "Улан-Удэ" } });
  const user = await prisma.user.findFirst({ where: { email: "damdikdamdin@gmail.com" } });
  const supplier = await prisma.supplier.findFirst();
  if (!irk || !ulan || !user || !supplier) throw new Error("Нужны точки Иркутск/Улан-Удэ, founder, поставщик");

  await ensureCashCategories();
  const cashMain = await ensureStoreCash(irk.id);
  let cashDamdin = await prisma.cashRegister.findFirst({
    where: { storeId: irk.id, name: { contains: "Дамдин" } },
  });
  if (!cashDamdin) {
    cashDamdin = await prisma.cashRegister.create({
      data: { storeId: irk.id, name: "касса Дамдин", balance: 0 },
    });
  }

  // Стартовый остаток в кассе (как внесение денег перед закупками)
  await postCashTxn({
    registerId: cashMain.id,
    direction: "in",
    amount: 200000,
    categoryName: "Прочий приход",
    userId: user.id,
    note: "E2E стартовый баланс",
  });
  step("0. Пополнение кассы 200 000 ₽", true, "стартовый баланс");

  const imeis = [randImei(), randImei(), randImei()];
  const names = [
    { name: "TEST iPhone 16 Pro 256GB Black", purchase: 82000, retail: 109900, imei: imeis[0] },
    { name: "TEST iPhone 16 Pro 256GB White", purchase: 82000, retail: 109900, imei: imeis[1] },
    { name: "TEST iPhone 15 128GB Blue", purchase: 55000, retail: 74900, imei: imeis[2] },
  ];

  // ========== 1. ПОСТУПЛЕНИЕ ==========
  const products: Array<{ id: string; name: string; imei: string }> = [];
  for (const row of names) {
    const code = `T${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const p = await prisma.product.create({
      data: {
        code,
        name: row.name,
        barcode: await nextProductBarcode(prisma, code),
        purchasePrice: row.purchase,
        retailPrice: row.retail,
        warrantyDays: 365,
        serialTracked: true,
        active: true,
      },
    });
    products.push({ id: p.id, name: p.name, imei: row.imei });
  }
  const caseCode = `C${Date.now().toString().slice(-6)}`;
  const caseProduct = await prisma.product.create({
    data: {
      code: caseCode,
      name: "TEST Чехол 16 Pro Clear",
      barcode: await nextProductBarcode(prisma, caseCode),
      purchasePrice: 800,
      retailPrice: 2500,
      warrantyDays: 90,
      serialTracked: false,
      active: true,
    },
  });

  const receipt = await prisma.stockDocument.create({
    data: {
      number: await nextDocNumber("C"),
      type: "receipt",
      storeId: irk.id,
      supplierId: supplier.id,
      userId: user.id,
      comment: "E2E тест поступления",
      totalAmount: 82000 * 2 + 55000 + 800,
      paidAmount: 50000,
      lines: {
        create: [
          ...names.map((row, i) => ({
            productId: products[i].id,
            qty: 1,
            price: row.purchase,
            retailPrice: row.retail,
            warrantyDays: 365,
            serial: row.imei,
          })),
          {
            productId: caseProduct.id,
            qty: 5,
            price: 800,
            retailPrice: 2500,
            warrantyDays: 90,
          },
        ],
      },
    },
  });
  await postStockDocument(receipt.id, user.id);
  await postCashTxn({
    registerId: cashMain.id,
    direction: "out",
    amount: 50000,
    categoryName: "Оплата поставщику",
    stockDocId: receipt.id,
    userId: user.id,
    note: receipt.number,
  });

  const serialsAfter = await prisma.productSerial.count({
    where: { storeId: irk.id, status: "in_stock", serial: { in: imeis } },
  });
  const balPhone = await prisma.stockBalance.findUnique({
    where: { storeId_productId: { storeId: irk.id, productId: products[0].id } },
  });
  step("1. Поступление 3 IMEI + чехлы", serialsAfter === 3 && (balPhone?.qty ?? 0) === 1, `IMEI in_stock=${serialsAfter}, bal=${balPhone?.qty}`);

  // ========== 2. ПЕРЕМЕЩЕНИЕ ==========
  const transferImei = imeis[2];
  const transferProduct = products[2];
  const transfer = await prisma.stockDocument.create({
    data: {
      number: await nextDocNumber("T"),
      type: "transfer",
      storeId: irk.id,
      toStoreId: ulan.id,
      userId: user.id,
      comment: "E2E перемещение в Улан-Удэ",
      lines: {
        create: [
          {
            productId: transferProduct.id,
            qty: 1,
            price: 55000,
            retailPrice: 74900,
            serial: transferImei,
          },
        ],
      },
    },
  });
  await postStockDocument(transfer.id, user.id);
  const serMoved = await prisma.productSerial.findFirst({
    where: { serial: transferImei },
  });
  step(
    "2. Перемещение IMEI Иркутск→Улан-Удэ",
    serMoved?.storeId === ulan.id && serMoved?.status === "in_stock",
    `store=${serMoved?.storeId === ulan.id ? "Улан-Удэ" : "?"} status=${serMoved?.status}`,
  );

  // ========== 3. ПРОДАЖА ==========
  const sellImei = imeis[0];
  const sellProduct = products[0];
  const saleNumber = await nextSaleNumber();
  const unitPrice = 109900;
  const sale = await prisma.$transaction(async (tx) => {
    await tx.productSerial.updateMany({
      where: { productId: sellProduct.id, serial: sellImei, storeId: irk.id },
      data: { status: "sold" },
    });
    await applyBalance(tx, irk.id, sellProduct.id, -1);
    const created = await tx.sale.create({
      data: {
        storeId: irk.id,
        sellerUserId: user.id,
        amount: unitPrice,
        number: saleNumber,
        note: "E2E продажа",
        lines: {
          create: [
            {
              productId: sellProduct.id,
              name: sellProduct.name,
              qty: 1,
              unitPrice,
              costPrice: 82000,
              lineTotal: unitPrice,
              serial: sellImei,
              warrantyDays: 365,
            },
          ],
        },
      },
    });
    await writeChangeLog(
      {
        storeId: irk.id,
        userId: user.id,
        entityType: "sale",
        entityId: created.id,
        action: "sell",
        summary: `E2E продажа ${saleNumber}: ${sellProduct.name} · ${sellImei}`,
        saleId: created.id,
        serialNew: sellImei,
        productId: sellProduct.id,
      },
      tx,
    );
    return created;
  });
  await postCashTxn({
    registerId: cashMain.id,
    direction: "in",
    amount: unitPrice,
    categoryName: "Продажа",
    saleId: sale.id,
    userId: user.id,
    note: saleNumber,
  });
  const soldSer = await prisma.productSerial.findFirst({ where: { serial: sellImei } });
  const cashAfterSale = await prisma.cashRegister.findUnique({ where: { id: cashMain.id } });
  step(
    "3. Продажа по IMEI",
    soldSer?.status === "sold" && (cashAfterSale?.balance ?? 0) >= unitPrice - 50000,
    `status=${soldSer?.status}, касса=${cashAfterSale?.balance} ₽, чек=${saleNumber}`,
  );

  // ========== 4. ПЕРЕМЕЩЕНИЕ ДЕНЕГ ==========
  const beforeMain = (await prisma.cashRegister.findUnique({ where: { id: cashMain.id } }))!.balance;
  const beforeDam = (await prisma.cashRegister.findUnique({ where: { id: cashDamdin.id } }))!.balance;
  const moveAmt = 15000;
  await postCashTxn({
    registerId: cashMain.id,
    direction: "out",
    amount: moveAmt,
    categoryName: "Перемещение между кассами",
    userId: user.id,
    note: `→ ${cashDamdin.name}`,
    recipient: cashDamdin.name,
  });
  await postCashTxn({
    registerId: cashDamdin.id,
    direction: "in",
    amount: moveAmt,
    categoryName: "Перемещение между кассами",
    userId: user.id,
    note: `← ${cashMain.name}`,
    recipient: cashMain.name,
  });
  // инкассация на закупки (часть)
  await postCashTxn({
    registerId: cashDamdin.id,
    direction: "out",
    amount: 5000,
    categoryName: "Инкассация на закупки",
    userId: user.id,
    note: "E2E инкассация",
  });
  const afterMain = (await prisma.cashRegister.findUnique({ where: { id: cashMain.id } }))!.balance;
  const afterDam = (await prisma.cashRegister.findUnique({ where: { id: cashDamdin.id } }))!.balance;
  step(
    "4. Перемещение денег + инкассация",
    afterMain === beforeMain - moveAmt && afterDam === beforeDam + moveAmt - 5000,
    `основная ${beforeMain}→${afterMain}, Дамдин ${beforeDam}→${afterDam}`,
  );

  // ========== 5. ИНВЕНТАРИЗАЦИЯ ==========
  // Осталось in_stock в Иркутске: imeis[1] (white) + чехлы 5
  const invImei = imeis[1];
  const invProduct = products[1];
  const inv = await prisma.stockDocument.create({
    data: {
      number: await nextDocNumber("I"),
      type: "inventory",
      storeId: irk.id,
      userId: user.id,
      comment: "E2E инвентаризация: телефон не найден",
      lines: {
        create: [
          {
            productId: invProduct.id,
            qty: 0,
            qtyAccount: 1,
            qtyActual: 0, // missing
            price: 82000,
            retailPrice: 109900,
            serial: invImei,
          },
          {
            productId: caseProduct.id,
            qty: 5,
            qtyAccount: 5,
            qtyActual: 5, // ok
            price: 800,
            retailPrice: 2500,
          },
        ],
      },
    },
  });
  await postStockDocument(inv.id, user.id);
  const invSer = await prisma.productSerial.findFirst({ where: { serial: invImei } });
  const caseBal = await prisma.stockBalance.findUnique({
    where: { storeId_productId: { storeId: irk.id, productId: caseProduct.id } },
  });
  step(
    "5. Инвентаризация (недостача телефона, чехлы OK)",
    invSer?.status === "written_off" && (caseBal?.qty ?? 0) === 5,
    `IMEI=${invSer?.status}, чехлы=${caseBal?.qty}`,
  );

  // ========== СВОДКА ==========
  const remainIrk = await prisma.productSerial.findMany({
    where: { storeId: irk.id },
    select: { serial: true, status: true, product: { select: { name: true } } },
  });
  const remainUlan = await prisma.productSerial.findMany({
    where: { storeId: ulan.id, serial: transferImei },
    select: { serial: true, status: true },
  });

  console.log("\n=== ТЕСТОВЫЕ IMEI ===");
  console.log(`  ${imeis[0]} — продан (Иркутск)`);
  console.log(`  ${imeis[1]} — недостача / written_off (инвентаризация)`);
  console.log(`  ${imeis[2]} — перемещён в Улан-Удэ (${remainUlan[0]?.status})`);
  console.log("\n=== СЕРИЙНИКИ ИРКУТСК ===");
  for (const s of remainIrk) console.log(`  ${s.serial} · ${s.status} · ${s.product.name}`);

  const failed = log.filter((x) => !x.ok);
  console.log("\n=== SUMMARY ===");
  console.log(`Total: ${log.length}  Pass: ${log.length - failed.length}  Fail: ${failed.length}`);
  if (failed.length) {
    process.exitCode = 1;
    for (const f of failed) console.log(` - ${f.step}: ${f.detail}`);
  } else {
    console.log("Все операционные сценарии отработали.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
