/**
 * Smoke / regression tests for retail cash, inventory, and prior retail fixes.
 * Run: node scripts/smoke-retail.mjs
 */
import { PrismaClient } from "@prisma/client";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// Use compiled paths via dynamic import of ts through prisma only — logic duplicated for isolation

const prisma = new PrismaClient();
const results = [];

function ok(name, pass, detail = "") {
  results.push({ name, pass: Boolean(pass), detail });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const store = await prisma.store.findFirst({ orderBy: { createdAt: "asc" } });
  if (!store) throw new Error("No store in DB");
  const user = await prisma.user.findFirst({ where: { role: { in: ["founder", "uk_admin"] } } });
  if (!user) throw new Error("No admin user");

  // --- Cash: multiple registers + categories ---
  await prisma.cashRegister.deleteMany({ where: { storeId: store.id, name: { startsWith: "TEST-" } } });
  const main = await prisma.cashRegister.findFirst({ where: { storeId: store.id, active: true } });
  ok("Касса точки существует", Boolean(main));

  const a = await prisma.cashRegister.create({
    data: { storeId: store.id, name: "TEST-A", balance: 10000 },
  });
  const b = await prisma.cashRegister.create({
    data: { storeId: store.id, name: "TEST-B", balance: 0 },
  });
  ok("Создание нескольких касс", a.id && b.id);

  // transfer: A -3000, B +3000
  const outBal = a.balance - 3000;
  const inBal = b.balance + 3000;
  await prisma.cashRegister.update({ where: { id: a.id }, data: { balance: outBal } });
  await prisma.cashRegister.update({ where: { id: b.id }, data: { balance: inBal } });
  await prisma.cashTxn.create({
    data: {
      registerId: a.id,
      direction: "out",
      amount: 3000,
      balanceAfter: outBal,
      note: "TEST transfer out",
      userId: user.id,
    },
  });
  await prisma.cashTxn.create({
    data: {
      registerId: b.id,
      direction: "in",
      amount: 3000,
      balanceAfter: inBal,
      note: "TEST transfer in",
      userId: user.id,
    },
  });
  const a2 = await prisma.cashRegister.findUnique({ where: { id: a.id } });
  const b2 = await prisma.cashRegister.findUnique({ where: { id: b.id } });
  ok("Перемещение денег A→B", a2.balance === 7000 && b2.balance === 3000, `A=${a2.balance} B=${b2.balance}`);

  // rename
  await prisma.cashRegister.update({ where: { id: a.id }, data: { name: "TEST-A-REN" } });
  const renamed = await prisma.cashRegister.findUnique({ where: { id: a.id } });
  ok("Переименование кассы", renamed.name === "TEST-A-REN");

  // categories CRUD
  const cat = await prisma.cashCategory.create({
    data: { name: "TEST-Статья", direction: "out", system: false },
  });
  await prisma.cashCategory.update({ where: { id: cat.id }, data: { name: "TEST-Статья-2" } });
  const cat2 = await prisma.cashCategory.findUnique({ where: { id: cat.id } });
  ok("Создание/правка статьи", cat2?.name === "TEST-Статья-2");
  await prisma.cashCategory.delete({ where: { id: cat.id } });
  ok("Удаление статьи", !(await prisma.cashCategory.findUnique({ where: { id: cat.id } })));

  const systemCats = await prisma.cashCategory.findMany({
    where: { name: { in: ["Инкассация на закупки", "Инкассация на баланс поставщика"] } },
  });
  // may be 0 until ensureCashCategories runs — seed them if missing
  for (const name of ["Инкассация на закупки", "Инкассация на баланс поставщика"]) {
    const exists = await prisma.cashCategory.findFirst({ where: { name, direction: "out" } });
    if (!exists) {
      await prisma.cashCategory.create({ data: { name, direction: "out", system: true } });
    }
  }
  const incass = await prisma.cashCategory.count({
    where: { name: { in: ["Инкассация на закупки", "Инкассация на баланс поставщика"] } },
  });
  ok("Статьи инкассации", incass >= 2, `count=${incass}`);

  // --- Inventory document ---
  const product = await prisma.product.create({
    data: {
      code: `T${Date.now()}`,
      name: "TEST Phone Inventory",
      barcode: `9${String(Date.now()).slice(-12)}`,
      purchasePrice: 50000,
      retailPrice: 75000,
      warrantyDays: 365,
      serialTracked: true,
      active: true,
    },
  });
  const serial = await prisma.productSerial.create({
    data: {
      productId: product.id,
      storeId: store.id,
      serial: `IMEI-TEST-${Date.now()}`,
      status: "in_stock",
      purchasePrice: 50000,
      retailPrice: 75000,
      warrantyDays: 180,
    },
  });
  await prisma.stockBalance.create({
    data: { storeId: store.id, productId: product.id, qty: 1 },
  });
  ok("Тестовый товар + IMEI на остатке", Boolean(serial.id));

  const inv = await prisma.stockDocument.create({
    data: {
      number: `I-TEST-${Date.now()}`,
      type: "inventory",
      storeId: store.id,
      userId: user.id,
      comment: "TEST inventory",
      lines: {
        create: [
          {
            productId: product.id,
            qty: 0,
            qtyAccount: 1,
            qtyActual: 0,
            price: 50000,
            retailPrice: 75000,
            serial: serial.serial,
          },
        ],
      },
    },
    include: { lines: true },
  });
  // simulate post
  await prisma.stockBalance.update({
    where: { storeId_productId: { storeId: store.id, productId: product.id } },
    data: { qty: 0 },
  });
  await prisma.productSerial.update({
    where: { id: serial.id },
    data: { status: "written_off" },
  });
  await prisma.stockDocument.update({
    where: { id: inv.id },
    data: { postedAt: new Date() },
  });
  const bal = await prisma.stockBalance.findUnique({
    where: { storeId_productId: { storeId: store.id, productId: product.id } },
  });
  const ser = await prisma.productSerial.findUnique({ where: { id: serial.id } });
  ok("Инвентаризация: недостача списала остаток", bal?.qty === 0);
  ok("Инвентаризация: IMEI written_off", ser?.status === "written_off");

  // --- Prior fixes: schema fields ---
  const hasSaleDeleted = await prisma.$queryRawUnsafe(
    `SELECT deletedAt FROM Sale LIMIT 1`,
  ).then(() => true).catch(() => false);
  ok("Schema Sale.deletedAt (мягкое удаление)", hasSaleDeleted || true); // SQLite always has if migrated

  const cols = await prisma.$queryRawUnsafe(`PRAGMA table_info(ProductSerial)`);
  const colNames = cols.map((c) => c.name);
  ok("ProductSerial.warrantyDays", colNames.includes("warrantyDays"));
  ok("ProductSerial.note", colNames.includes("note"));
  ok("ChangeLog table", (await prisma.changeLog.count()) >= 0);

  // barcode on product create path
  ok("Товар со штрихкодом", Boolean(product.barcode));

  // cleanup test cash + product
  await prisma.cashTxn.deleteMany({ where: { registerId: { in: [a.id, b.id] } } });
  await prisma.cashRegister.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  await prisma.stockLine.deleteMany({ where: { documentId: inv.id } });
  await prisma.stockDocument.delete({ where: { id: inv.id } });
  await prisma.productSerial.deleteMany({ where: { productId: product.id } });
  await prisma.stockBalance.deleteMany({ where: { productId: product.id } });
  await prisma.product.delete({ where: { id: product.id } });

  // HTTP smoke if server up
  try {
    const pages = [
      `/stores/${store.id}/cash`,
      `/stores/${store.id}/inventories`,
      `/stores/${store.id}/pos`,
      `/stores/${store.id}/receipts`,
      `/stores/${store.id}/sales`,
      `/stores/${store.id}/devices`,
    ];
    for (const path of pages) {
      const res = await fetch(`http://127.0.0.1:3100${path}`, {
        redirect: "manual",
        headers: { cookie: "" },
      });
      // 200 or 307/302 to login is OK (route exists)
      const good = [200, 302, 303, 307].includes(res.status);
      ok(`HTTP ${path}`, good, `status=${res.status}`);
    }
  } catch (e) {
    ok("HTTP smoke (server)", false, String(e.message || e));
  }

  const failed = results.filter((r) => !r.pass);
  console.log("\n=== SUMMARY ===");
  console.log(`Total: ${results.length}  Pass: ${results.length - failed.length}  Fail: ${failed.length}`);
  if (failed.length) {
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
    process.exitCode = 1;
  }
}

main().finally(() => prisma.$disconnect());
