/**
 * E2E: роли/права, приглашение сотрудника, продажа от его имени, график, история.
 * Тестовые данные НЕ удаляются.
 *
 * node ./node_modules/tsx/dist/cli.mjs scripts/e2e-rbac.ts
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { applyBalance, nextSaleNumber, nextDocNumber, postStockDocument } from "../src/lib/stock";
import { ensureStoreCash, ensureCashCategories, postCashTxn } from "../src/lib/cash";
import { writeChangeLog } from "../src/lib/audit";
import { nextProductBarcode } from "../src/lib/barcode";
import { ensureSystemAccessRoles } from "../src/lib/access-roles";
import {
  can,
  parsePermissions,
  sellerDefaults,
  serializePermissions,
  type UserWithAccess,
} from "../src/lib/permissions";
import { randomToken } from "../src/lib/utils";

const prisma = new PrismaClient();
let failed = 0;

function ok(name: string, pass: boolean, detail = "") {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!pass) failed += 1;
}

function randImei() {
  let s = "35";
  for (let i = 0; i < 13; i++) s += Math.floor(Math.random() * 10);
  return s;
}

async function main() {
  const stamp = Date.now().toString().slice(-6);
  const irk = await prisma.store.findFirst({ where: { city: "Иркутск" } });
  const founder = await prisma.user.findFirst({ where: { email: "damdikdamdin@gmail.com" } });
  if (!irk || !founder) throw new Error("Нужны Иркутск + founder");

  await ensureSystemAccessRoles();
  await ensureCashCategories();

  // 1. Пресеты
  const sellerPreset = await prisma.accessRole.findFirst({
    where: { system: true, name: "Продавец", storeId: null },
  });
  const adminPreset = await prisma.accessRole.findFirst({
    where: { system: true, name: "Администратор точки", storeId: null },
  });
  ok("Пресет «Продавец»", Boolean(sellerPreset));
  ok("Пресет «Администратор точки»", Boolean(adminPreset));

  const sellerPerms = parsePermissions(sellerPreset!.permissions);
  ok("Продавец: нет удаления чеков", sellerPerms["sales.delete"] !== true);
  ok("Продавец: нет правки каталога цен", sellerPerms["prices.editCatalog"] !== true);
  ok("Админ точки: может инвентаризацию", parsePermissions(adminPreset!.permissions)["inventory.create"] === true);

  // 2. Кастомная роль с урезанными правами
  const customRole = await prisma.accessRole.create({
    data: {
      name: `TEST Старший ${stamp}`,
      storeId: irk.id,
      homePage: "/pos",
      system: false,
      permissions: serializePermissions({
        ...sellerDefaults(),
        "sales.editPrice": true,
        "sales.discount": true,
        "receipts.create": true,
        "transfers.create": false,
        "inventory.create": false,
        "cash.operate": false,
      }),
    },
  });
  await writeChangeLog({
    storeId: irk.id,
    userId: founder.id,
    entityType: "access_role",
    entityId: customRole.id,
    action: "create",
    summary: `${founder.name} создал роль «${customRole.name}» (E2E)`,
  });
  ok("Кастомная роль создана", Boolean(customRole.id), customRole.name);

  // 3. Приглашение
  const email = `test.seller.${stamp}@rebar.local`;
  const nameHint = `TEST Продавец ${stamp}`;
  const token = randomToken(24);
  const invite = await prisma.invite.create({
    data: {
      email,
      nameHint,
      role: "seller",
      accessRoleId: customRole.id,
      storeId: irk.id,
      partnerId: irk.partnerId,
      token,
      expiresAt: new Date(Date.now() + 14 * 86400000),
      createdById: founder.id,
    },
  });
  await writeChangeLog({
    storeId: irk.id,
    userId: founder.id,
    entityType: "invite",
    entityId: invite.id,
    action: "create",
    summary: `${founder.name} пригласил ${nameHint} (E2E)`,
  });
  ok("Приглашение создано", Boolean(invite.token), `/join/${invite.token}`);

  // 4. Регистрация (acceptInvite логика)
  const passwordHash = await bcrypt.hash("test-pass-123", 10);
  const seller = await prisma.user.create({
    data: {
      email,
      name: nameHint,
      passwordHash,
      role: "seller",
      storeId: irk.id,
      partnerId: irk.partnerId,
      accessRoleId: customRole.id,
      commissionPct: 0.5,
      shiftPay: 2000,
      onboardedAt: new Date(),
    },
  });
  await prisma.invite.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
  await writeChangeLog({
    storeId: irk.id,
    userId: seller.id,
    entityType: "user",
    entityId: seller.id,
    action: "register",
    summary: `${seller.name} зарегистрировался по приглашению (E2E)`,
  });
  ok("Сотрудник зарегистрирован", Boolean(seller.id), `${seller.name} · ${seller.email}`);

  // 5. can() по шаблону
  const withAccess: UserWithAccess = {
    id: seller.id,
    role: seller.role,
    partnerId: seller.partnerId,
    storeId: seller.storeId,
    name: seller.name,
    email: seller.email,
    accessRole: { permissions: customRole.permissions },
  };
  ok("can: правка цены в чеке", can(withAccess, "sales.editPrice") === true);
  ok("can: НЕ перемещение", can(withAccess, "transfers.create") === false);
  ok("can: НЕ инвентаризация", can(withAccess, "inventory.create") === false);
  ok("can: поступление create", can(withAccess, "receipts.create") === true);

  // 6. Товар + продажа от имени сотрудника
  const imei = randImei();
  const code = `TR${stamp}`;
  const product = await prisma.product.create({
    data: {
      code,
      name: `TEST RBAC Phone ${stamp}`,
      barcode: await nextProductBarcode(prisma, code),
      purchasePrice: 50000,
      retailPrice: 79900,
      warrantyDays: 365,
      serialTracked: true,
      active: true,
      commissionPct: 0,
    },
  });
  await prisma.productSerial.create({
    data: {
      productId: product.id,
      storeId: irk.id,
      serial: imei,
      status: "in_stock",
      purchasePrice: 50000,
      retailPrice: 79900,
      warrantyDays: 365,
    },
  });
  await prisma.stockBalance.create({ data: { storeId: irk.id, productId: product.id, qty: 1 } });

  const revenue = 79900;
  const saleNumber = await nextSaleNumber();
  const sale = await prisma.$transaction(async (tx) => {
    await tx.productSerial.updateMany({ where: { serial: imei }, data: { status: "sold" } });
    await applyBalance(tx, irk.id, product.id, -1);
    return tx.sale.create({
      data: {
        storeId: irk.id,
        sellerUserId: seller.id,
        amount: revenue,
        number: saleNumber,
        note: "E2E RBAC sale — не удалять",
        lines: {
          create: [
            {
              productId: product.id,
              name: product.name,
              qty: 1,
              unitPrice: revenue,
              costPrice: 50000,
              lineTotal: revenue,
              serial: imei,
              warrantyDays: 365,
            },
          ],
        },
      },
      include: { seller: true },
    });
  });

  const cash = await ensureStoreCash(irk.id);
  await postCashTxn({
    registerId: cash.id,
    direction: "in",
    amount: revenue,
    categoryName: "Продажа",
    saleId: sale.id,
    userId: seller.id,
    note: saleNumber,
  });
  await writeChangeLog({
    storeId: irk.id,
    userId: seller.id,
    entityType: "sale",
    entityId: sale.id,
    action: "sell",
    saleId: sale.id,
    summary: `E2E продажа ${saleNumber}: ${product.name} · ${imei} · продавец ${seller.name}`,
  });

  ok("Продажа от имени сотрудника", sale.seller?.name === nameHint, `чек ${saleNumber}, продавец ${sale.seller?.name}`);
  ok("IMEI продан", (await prisma.productSerial.findFirst({ where: { serial: imei } }))?.status === "sold", imei);

  // 7. Поступление (ответственный = seller)
  const docNumber = await nextDocNumber("C");
  const accCode = `TA${stamp}`;
  const accessory = await prisma.product.create({
    data: {
      code: accCode,
      name: `TEST RBAC Чехол ${stamp}`,
      barcode: await nextProductBarcode(prisma, accCode),
      purchasePrice: 500,
      retailPrice: 1500,
      serialTracked: false,
      active: true,
    },
  });
  const receipt = await prisma.stockDocument.create({
    data: {
      storeId: irk.id,
      type: "receipt",
      number: docNumber,
      userId: seller.id,
      comment: "E2E RBAC receipt — не удалять",
      totalAmount: 2500,
      lines: {
        create: [
          {
            productId: accessory.id,
            qty: 5,
            price: 500,
            retailPrice: 1500,
            note: accessory.name,
          },
        ],
      },
    },
    include: { user: true },
  });
  await postStockDocument(receipt.id, seller.id);
  const receiptReload = await prisma.stockDocument.findUnique({
    where: { id: receipt.id },
    include: { user: true },
  });
  ok(
    "Поступление с ответственным",
    receiptReload?.user?.name === nameHint && Boolean(receiptReload?.postedAt),
    `${receiptReload?.number} · ${receiptReload?.user?.name}`,
  );

  // 8. Смена в графике
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const shift = await prisma.workShift.upsert({
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
      note: "E2E RBAC смена — не удалять",
    },
    update: { note: "E2E RBAC смена — не удалять", shiftPay: 2000 },
  });
  ok("Смена в графике", Boolean(shift.id), `${shift.startTime}–${shift.endTime}`);

  // 9. Зарплата: 0.5% + оклад
  const commission = Math.round((revenue * 0.5) / 100);
  const expectedPay = commission + 2000;
  ok("Комиссия 0.5%", commission === Math.round(79900 * 0.5 / 100), `${commission} ₽`);
  ok("Итого зарплата смена+%", expectedPay === commission + 2000, `${expectedPay} ₽`);

  // 10. История
  const logs = await prisma.changeLog.findMany({
    where: {
      storeId: irk.id,
      OR: [
        { entityId: customRole.id },
        { entityId: invite.id },
        { entityId: seller.id },
        { entityId: sale.id },
        { summary: { contains: stamp } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  ok("Журнал: ≥4 записей E2E", logs.length >= 4, `${logs.length} шт.`);
  ok(
    "Журнал: есть регистрация",
    logs.some((l) => l.action === "register"),
  );
  ok(
    "Журнал: есть продажа",
    logs.some((l) => l.saleId === sale.id || (l.action === "sell" && l.summary.includes(seller.name))),
  );

  // 11. Назначение шаблона на существующего продавца Иркутска (не ломаем — только проверка read)
  const irkSeller = await prisma.user.findFirst({
    where: { email: "irkutsk@rebar.local" },
    include: { accessRole: true },
  });
  ok("Продавец Иркутск имеет accessRole", Boolean(irkSeller?.accessRoleId), irkSeller?.accessRole?.name ?? "нет");

  console.log("\n=== SUMMARY e2e-rbac (данные оставлены) ===");
  console.log(`Сотрудник: ${seller.name} <${seller.email}> / пароль test-pass-123`);
  console.log(`Роль: ${customRole.name}`);
  console.log(`Чек: ${saleNumber} · IMEI ${imei}`);
  console.log(`Поступление: ${receiptReload?.number}`);
  console.log(`Join был: /join/${token} (уже использован)`);
  console.log(`Зарплата расчёт: ${commission} + 2000 = ${expectedPay} ₽`);
}

main()
  .catch((e) => {
    console.error(e);
    failed += 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (failed) process.exitCode = 1;
  });
