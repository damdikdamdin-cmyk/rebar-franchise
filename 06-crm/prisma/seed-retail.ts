/**
 * Досеивание розницы в уже существующую OS-базу без полной очистки.
 * Запуск: npx tsx prisma/seed-retail.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.product.count();
  if (existing > 0) {
    console.log(`Retail already seeded (${existing} products), skip.`);
    return;
  }

  const ulan = await prisma.store.findFirst({ where: { city: "Улан-Удэ" } });
  const irkutsk = await prisma.store.findFirst({ where: { city: "Иркутск" } });
  if (!ulan || !irkutsk) throw new Error("Owned stores Улан-Удэ / Иркутск not found — run full db:seed first");

  await prisma.store.update({
    where: { id: ulan.id },
    data: { legalName: "ИП Цыпылова Сарюна Баяржаповна" },
  });

  const seller =
    (await prisma.user.findFirst({ where: { storeId: ulan.id } })) ??
    (await prisma.user.findFirst({ where: { role: "founder" } }));

  const supplier = await prisma.supplier.create({
    data: { name: "Поставщик МСК", phone: "+7 495 000-00-00" },
  });
  const apple = await prisma.productGroup.create({ data: { name: "Apple", sortOrder: 1 } });
  const phones = await prisma.productGroup.create({
    data: { name: "Телефоны Apple", parentId: apple.id, sortOrder: 1 },
  });
  const accessories = await prisma.productGroup.create({ data: { name: "Аксессуары", sortOrder: 2 } });
  const cases = await prisma.productGroup.create({
    data: { name: "Чехлы", parentId: accessories.id, sortOrder: 1 },
  });
  await prisma.productGroup.create({ data: { name: "Samsung", sortOrder: 3 } });

  const iphone = await prisma.product.create({
    data: {
      code: "270",
      name: "Apple iPhone 16 Pro 256GB Black",
      groupId: phones.id,
      supplierId: supplier.id,
      serialTracked: true,
      purchasePrice: 98900,
      retailPrice: 124900,
      repairPrice: 119900,
      preorderPrice: 129900,
      warrantyDays: 365,
      minStock: 1,
      commissionPct: 1,
    },
  });
  const airpods = await prisma.product.create({
    data: {
      code: "512",
      name: "AirPods Pro 2",
      groupId: accessories.id,
      supplierId: supplier.id,
      purchasePrice: 14900,
      retailPrice: 18900,
      warrantyDays: 365,
      minStock: 3,
      commissionPct: 3,
    },
  });
  const charger = await prisma.product.create({
    data: {
      code: "189",
      name: "СЗУ 20W",
      groupId: accessories.id,
      purchasePrice: 1800,
      retailPrice: 3000,
      warrantyDays: 90,
      minStock: 5,
      commissionRub: 100,
    },
  });
  const caseProd = await prisma.product.create({
    data: {
      code: "301",
      name: "Silicon case 16 Pro",
      groupId: cases.id,
      purchasePrice: 900,
      retailPrice: 1800,
      warrantyDays: 30,
      minStock: 5,
    },
  });

  await prisma.stockBalance.createMany({
    data: [
      { storeId: ulan.id, productId: iphone.id, qty: 3 },
      { storeId: ulan.id, productId: airpods.id, qty: 8 },
      { storeId: ulan.id, productId: charger.id, qty: 12 },
      { storeId: ulan.id, productId: caseProd.id, qty: 15 },
      { storeId: irkutsk.id, productId: iphone.id, qty: 2 },
      { storeId: irkutsk.id, productId: airpods.id, qty: 5 },
      { storeId: irkutsk.id, productId: charger.id, qty: 10 },
      { storeId: irkutsk.id, productId: caseProd.id, qty: 20 },
    ],
  });
  await prisma.productSerial.createMany({
    data: [
      { productId: iphone.id, storeId: ulan.id, serial: "SN-UU-001", status: "in_stock" },
      { productId: iphone.id, storeId: ulan.id, serial: "SN-UU-002", status: "in_stock" },
      { productId: iphone.id, storeId: ulan.id, serial: "SN-UU-003", status: "in_stock" },
      { productId: iphone.id, storeId: irkutsk.id, serial: "SN-IRK-001", status: "in_stock" },
      { productId: iphone.id, storeId: irkutsk.id, serial: "SN-IRK-002", status: "in_stock" },
    ],
  });

  if ((await prisma.cashCategory.count()) === 0) {
    await prisma.cashCategory.createMany({
      data: [
        { name: "Продажа", direction: "in", system: true },
        { name: "Предоплата заказа", direction: "in", system: true },
        { name: "Оплата поставщику", direction: "out", system: true },
        { name: "Возврат клиенту", direction: "out", system: true },
        { name: "Выдача учредителю", direction: "out", system: false },
        { name: "Логистика", direction: "out", system: false },
        { name: "Прочий приход", direction: "in", system: false },
        { name: "Прочий расход", direction: "out", system: false },
      ],
    });
  }
  if ((await prisma.cashRegister.count()) === 0) {
    await prisma.cashRegister.createMany({
      data: [
        { storeId: ulan.id, name: "Касса Улан-Удэ", balance: 150000 },
        { storeId: irkutsk.id, name: "Касса Иркутск", balance: 98000 },
      ],
    });
  }

  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  };
  const c1 = await prisma.customer.create({
    data: { storeId: ulan.id, name: "Андрей М.", phone: "+7 914 000 11 22" },
  });
  await prisma.customer.create({ data: { storeId: ulan.id, name: "Саяна Д.", phone: "+7 902 111 22 33" } });
  await prisma.customer.create({ data: { storeId: irkutsk.id, name: "Игорь К.", phone: "+7 395 200 00 01" } });

  await prisma.sale.create({
    data: {
      storeId: ulan.id,
      customerId: c1.id,
      sellerUserId: seller?.id,
      amount: 3000,
      number: "S000001",
      note: "СЗУ 20W",
      soldAt: daysAgo(1),
      lines: {
        create: [{ productId: charger.id, name: charger.name, qty: 1, unitPrice: 3000, lineTotal: 3000, warrantyDays: 90 }],
      },
    },
  });
  await prisma.sale.create({
    data: {
      storeId: irkutsk.id,
      amount: 18900,
      number: "S000002",
      note: "AirPods Pro 2",
      soldAt: daysAgo(3),
      lines: {
        create: [{ productId: airpods.id, name: airpods.name, qty: 1, unitPrice: 18900, lineTotal: 18900, warrantyDays: 365 }],
      },
    },
  });

  console.log("Retail seeded into OS");
  console.log(`  products ${iphone.code}, ${airpods.code}, ${charger.code}, ${caseProd.code}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
