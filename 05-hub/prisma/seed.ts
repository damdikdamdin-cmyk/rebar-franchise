import { PrismaClient, type StoreFormat } from "@prisma/client";
import bcrypt from "bcryptjs";
import { LAUNCH_TASKS } from "../src/lib/launch-template";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_PASSWORD ?? "rebar-hub";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.cashTxn.deleteMany();
  await prisma.cashRegister.deleteMany();
  await prisma.cashCategory.deleteMany();
  await prisma.orderLine.deleteMany();
  await prisma.order.deleteMany();
  await prisma.saleLine.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.stockLine.deleteMany();
  await prisma.stockDocument.deleteMany();
  await prisma.productSerial.deleteMany();
  await prisma.stockBalance.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productGroup.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.launchTask.deleteMany();
  await prisma.launchProject.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.leadActivity.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.user.deleteMany();
  await prisma.store.deleteMany();
  await prisma.partner.deleteMany();

  await prisma.user.create({
    data: {
      email: "damdikdamdin@gmail.com",
      name: "Дамдин Цыпылов",
      passwordHash,
      role: "founder",
    },
  });

  const sales = await prisma.user.create({
    data: {
      email: "sales@rebar.local",
      name: "Менеджер УК",
      passwordHash,
      role: "uk_sales",
    },
  });

  const curator = await prisma.user.create({
    data: {
      email: "curator@rebar.local",
      name: "Куратор запуска",
      passwordHash,
      role: "uk_curator",
    },
  });

  const ulan = await prisma.store.create({
    data: {
      name: "re:bar Улан-Удэ",
      city: "Улан-Удэ",
      kind: "owned",
      format: "flagship",
      status: "open",
      openedAt: new Date("2025-03-01"),
      address: "Улан-Удэ",
      phone: "+7 3012 00-00-00",
    },
  });

  const irkutsk = await prisma.store.create({
    data: {
      name: "re:bar Иркутск",
      city: "Иркутск",
      kind: "owned",
      format: "standard",
      status: "open",
      openedAt: new Date("2021-06-01"),
      address: "Иркутск",
      phone: "+7 3952 00-00-00",
    },
  });

  const seller = await prisma.user.create({
    data: {
      email: "ulan@rebar.local",
      name: "Продавец Улан-Удэ",
      passwordHash,
      role: "seller",
      storeId: ulan.id,
      commissionPct: 2,
    },
  });

  await prisma.user.create({
    data: {
      email: "irkutsk@rebar.local",
      name: "Продавец Иркутск",
      passwordHash,
      role: "seller",
      storeId: irkutsk.id,
      commissionPct: 2,
    },
  });

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

  await prisma.cashRegister.createMany({
    data: [
      { storeId: ulan.id, name: "Касса Улан-Удэ", balance: 150000 },
      { storeId: irkutsk.id, name: "Касса Иркутск", balance: 98000 },
    ],
  });

  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  };

  const c1 = await prisma.customer.create({
    data: { storeId: ulan.id, name: "Андрей М.", phone: "+7 914 000 11 22" },
  });
  await prisma.customer.create({
    data: { storeId: ulan.id, name: "Саяна Д.", phone: "+7 902 111 22 33" },
  });
  await prisma.customer.create({
    data: { storeId: irkutsk.id, name: "Игорь К.", phone: "+7 395 200 00 01" },
  });

  await prisma.sale.create({
    data: {
      storeId: ulan.id,
      customerId: c1.id,
      sellerUserId: seller.id,
      amount: 3000,
      number: "S000001",
      note: "СЗУ 20W",
      soldAt: daysAgo(1),
      lines: {
        create: [
          {
            productId: charger.id,
            name: charger.name,
            qty: 1,
            unitPrice: 3000,
            lineTotal: 3000,
          },
        ],
      },
    },
  });

  await prisma.lead.create({
    data: {
      name: "Павел",
      phone: "+7 999 111 22 33",
      city: "Чита",
      note: "Бюджет ~4 млн, хочет стандарт",
      source: "landing",
      stage: "zoom",
      ownerUserId: sales.id,
    },
  });

  await prisma.lead.create({
    data: {
      name: "Марина",
      phone: "+7 924 555 66 77",
      city: "Улан-Удэ",
      note: "Интерес к второй точке",
      source: "instagram",
      stage: "new",
      ownerUserId: sales.id,
    },
  });

  const format: StoreFormat = "standard";
  const partner = await prisma.partner.create({
    data: {
      name: "ИП Петров · Чита",
      phone: "+7 914 700 00 01",
      email: "partner@rebar.local",
      city: "Чита",
      status: "onboarding",
      format,
      signedAt: daysAgo(12),
      curatorUserId: curator.id,
    },
  });

  const launchStore = await prisma.store.create({
    data: {
      name: "re:bar Чита",
      city: "Чита",
      kind: "franchise",
      format,
      status: "launch",
      partnerId: partner.id,
    },
  });

  await prisma.user.create({
    data: {
      email: "partner@rebar.local",
      name: "Партнёр Чита",
      passwordHash,
      role: "partner",
      partnerId: partner.id,
    },
  });

  const startedAt = daysAgo(12);
  const target = new Date(startedAt);
  target.setDate(target.getDate() + 90);

  const project = await prisma.launchProject.create({
    data: {
      partnerId: partner.id,
      storeId: launchStore.id,
      curatorUserId: curator.id,
      startedAt,
      targetOpenAt: target,
      status: "active",
    },
  });

  await prisma.launchTask.createMany({
    data: LAUNCH_TASKS.map((task, index) => ({
      projectId: project.id,
      code: task.code,
      title: task.title,
      phase: task.phase,
      ownerRole: task.ownerRole,
      dueOffsetDays: task.dueOffsetDays,
      sortOrder: index,
      status: index < 3 ? "done" : index === 3 ? "in_progress" : "pending",
      completedAt: index < 3 ? daysAgo(8 - index) : null,
    })),
  });

  console.log("Seeded re:bar Hub retail");
  console.log(`  founder  damdikdamdin@gmail.com / ${password}`);
  console.log(`  products ${iphone.code}, ${airpods.code}, ${charger.code}, ${caseProd.code}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
