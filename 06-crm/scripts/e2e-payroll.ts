/**
 * Тест: продажа → комиссия 0.5% + оклад смены 2000 ₽ → выплата.
 * node ./node_modules/tsx/dist/cli.mjs scripts/e2e-payroll.ts
 */
import { PrismaClient } from "@prisma/client";
import { applyBalance, nextSaleNumber } from "../src/lib/stock";
import { ensureStoreCash, ensureCashCategories, postCashTxn } from "../src/lib/cash";
import { nextProductBarcode } from "../src/lib/barcode";

const prisma = new PrismaClient();

function ok(name: string, pass: boolean, detail = "") {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!pass) process.exitCode = 1;
}

function randImei() {
  let s = "35";
  for (let i = 0; i < 13; i++) s += Math.floor(Math.random() * 10);
  return s;
}

async function main() {
  const irk = await prisma.store.findFirst({ where: { city: "Иркутск" } });
  const seller = await prisma.user.findFirst({
    where: { email: "irkutsk@rebar.local" },
  });
  const founder = await prisma.user.findFirst({ where: { email: "damdikdamdin@gmail.com" } });
  if (!irk || !seller || !founder) throw new Error("Нужны Иркутск + продавец irkutsk@rebar.local");

  // ставки: 0.5% + оклад 2000
  await prisma.user.update({
    where: { id: seller.id },
    data: { commissionPct: 0.5, shiftPay: 2000, storeId: irk.id },
  });
  const updated = await prisma.user.findUnique({ where: { id: seller.id } });
  ok("Ставки продавца 0.5% / 2000 ₽", updated?.commissionPct === 0.5 && updated?.shiftPay === 2000);

  await ensureCashCategories();
  const cash = await ensureStoreCash(irk.id);
  await postCashTxn({
    registerId: cash.id,
    direction: "in",
    amount: 500000,
    categoryName: "Прочий приход",
    userId: founder.id,
    note: "E2E payroll float",
  });

  const imei = randImei();
  const code = `P${Date.now().toString().slice(-7)}`;
  const product = await prisma.product.create({
    data: {
      code,
      name: "TEST Payroll Phone",
      barcode: await nextProductBarcode(prisma, code),
      purchasePrice: 60000,
      retailPrice: 100000,
      warrantyDays: 365,
      serialTracked: true,
      active: true,
      commissionPct: 0, // комиссия с сотрудника
    },
  });
  await prisma.productSerial.create({
    data: {
      productId: product.id,
      storeId: irk.id,
      serial: imei,
      status: "in_stock",
      purchasePrice: 60000,
      retailPrice: 100000,
    },
  });
  await prisma.stockBalance.create({ data: { storeId: irk.id, productId: product.id, qty: 1 } });

  const revenue = 100000;
  const expectedCommission = Math.round((revenue * 0.5) / 100); // 500
  const expectedShift = 2000;
  const expectedTotal = expectedCommission + expectedShift;

  const saleNumber = await nextSaleNumber();
  const sale = await prisma.$transaction(async (tx) => {
    await tx.productSerial.updateMany({
      where: { serial: imei },
      data: { status: "sold" },
    });
    await applyBalance(tx, irk.id, product.id, -1);
    return tx.sale.create({
      data: {
        storeId: irk.id,
        sellerUserId: seller.id,
        amount: revenue,
        number: saleNumber,
        note: "E2E payroll sale",
        lines: {
          create: [
            {
              productId: product.id,
              name: product.name,
              qty: 1,
              unitPrice: revenue,
              costPrice: 60000,
              lineTotal: revenue,
              serial: imei,
              warrantyDays: 365,
            },
          ],
        },
      },
    });
  });
  await postCashTxn({
    registerId: cash.id,
    direction: "in",
    amount: revenue,
    categoryName: "Продажа",
    saleId: sale.id,
    userId: seller.id,
    note: saleNumber,
  });
  ok("Продажа 100 000 ₽ оформлена", Boolean(sale.id), `чек ${saleNumber}, IMEI ${imei}`);

  // смена сегодня
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  await prisma.workShift.upsert({
    where: {
      storeId_userId_date: { storeId: irk.id, userId: seller.id, date: today },
    },
    create: {
      storeId: irk.id,
      userId: seller.id,
      date: today,
      startTime: "10:00",
      endTime: "20:00",
      shiftPay: 2000,
      note: "E2E смена",
    },
    update: { shiftPay: 2000, startTime: "10:00", endTime: "20:00" },
  });
  // правка смены
  const shift = await prisma.workShift.findFirst({
    where: { storeId: irk.id, userId: seller.id, date: today },
  });
  await prisma.workShift.update({
    where: { id: shift!.id },
    data: { endTime: "21:00", note: "E2E смена (edited)" },
  });
  const edited = await prisma.workShift.findUnique({ where: { id: shift!.id } });
  ok("График: смена создана и отредактирована", Boolean(edited?.endTime === "21:00" && edited?.note?.includes("edited")));

  // расчёт как на странице зарплаты
  const sales = await prisma.sale.findMany({
    where: { id: sale.id },
    include: { seller: true, lines: { include: { product: true } } },
  });
  let commission = 0;
  let rev = 0;
  for (const s of sales) {
    rev += s.amount;
    for (const line of s.lines) {
      const pct =
        line.product?.commissionPct && line.product.commissionPct > 0
          ? line.product.commissionPct
          : s.seller?.commissionPct ?? 0;
      commission += Math.round((line.lineTotal * pct) / 100);
    }
  }
  const shiftsCount = await prisma.workShift.count({
    where: { storeId: irk.id, userId: seller.id, date: today },
  });
  const shiftSalary = shiftsCount * 2000;
  const total = commission + shiftSalary;

  ok("Комиссия 0.5% от 100000 = 500 ₽", commission === expectedCommission, `got ${commission}`);
  ok("Оклад за 1 смену = 2000 ₽", shiftSalary === expectedShift, `got ${shiftSalary}`);
  ok("Итого к выплате = 2500 ₽", total === expectedTotal, `got ${total}`);

  // выплата из кассы
  const before = (await prisma.cashRegister.findUnique({ where: { id: cash.id } }))!.balance;
  await postCashTxn({
    registerId: cash.id,
    direction: "out",
    amount: total,
    categoryName: "Зарплата",
    userId: founder.id,
    recipient: seller.name,
    note: `Зарплата · ${seller.name}`,
  });
  const after = (await prisma.cashRegister.findUnique({ where: { id: cash.id } }))!.balance;
  ok("Выплата списана с кассы", after === before - total, `${before} → ${after}`);

  console.log("\n=== SUMMARY payroll ===");
  console.log(`Выручка: ${rev} ₽`);
  console.log(`Комиссия 0.5%: ${commission} ₽`);
  console.log(`Смены: ${shiftsCount} × 2000 = ${shiftSalary} ₽`);
  console.log(`Итого: ${total} ₽`);
  console.log(`IMEI: ${imei}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
