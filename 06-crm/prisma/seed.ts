import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { LAUNCH_TASKS } from "../src/lib/launch-template";

const prisma = new PrismaClient();

const SPACES = [
  { slug: "strategy", name: "Стратегия УК", icon: "compass", description: "Операционная библия УК: цели, финмодель, оргструктура, спринты.", visibleRoles: "founder,uk_admin,uk_sales,uk_curator,uk_marketer", sortOrder: 1 },
  { slug: "legal", name: "Юрпакет", icon: "scale", description: "NDA, лицензия ноу-хау, ДКК, соглашение о закупке, услуги.", visibleRoles: "founder,uk_admin,uk_sales,uk_curator,partner", sortOrder: 2 },
  { slug: "launch", name: "Запуск партнёра", icon: "rocket", description: "Методичка 60–90 дней, открытие, маркетинг открытия.", visibleRoles: "founder,uk_admin,uk_curator,uk_marketer,partner,store_manager", sortOrder: 3 },
  { slug: "sales", name: "Продажи франшизы", icon: "phone", description: "Скрипты, FAQ, презентация, работа с заявками.", visibleRoles: "founder,uk_admin,uk_sales", sortOrder: 4 },
  { slug: "marketing", name: "Маркетинг", icon: "megaphone", description: "Планы, контент, креативы, аналитика, стратегия розницы.", visibleRoles: "founder,uk_admin,uk_marketer,uk_curator,partner", sortOrder: 5 },
  { slug: "retail", name: "Розница и операции", icon: "store", description: "Рабочий день точки, стандарты, POS и склад в OS.", visibleRoles: "", sortOrder: 6 },
];

async function main() {
  const password = process.env.SEED_PASSWORD ?? "rebar-os";
  const passwordHash = await bcrypt.hash(password, 10);

  // Полная очистка (порядок важен из-за FK)
  await prisma.lessonProgress.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.course.deleteMany();
  await prisma.kbAttachment.deleteMany();
  await prisma.kbArticle.deleteMany();
  await prisma.kbSpace.deleteMany();
  await prisma.utmLink.deleteMany();
  await prisma.contentItem.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.task.deleteMany();
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
  await prisma.customer.deleteMany();
  await prisma.printTemplate.deleteMany();
  await prisma.launchTask.deleteMany();
  await prisma.launchProject.deleteMany();
  await prisma.leadActivity.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.user.deleteMany();
  await prisma.store.deleteMany();
  await prisma.partner.deleteMany();

  for (const s of SPACES) await prisma.kbSpace.create({ data: s });

  const founder = await prisma.user.create({
    data: { email: "damdikdamdin@gmail.com", name: "Дамдин Цыпылов", role: "founder", passwordHash, onboardedAt: new Date() },
  });
  const sales = await prisma.user.create({
    data: { email: "sales@rebar.local", name: "Менеджер продаж", role: "uk_sales", passwordHash, onboardedAt: new Date() },
  });
  const curator = await prisma.user.create({
    data: { email: "curator@rebar.local", name: "Куратор запуска", role: "uk_curator", passwordHash, onboardedAt: new Date() },
  });
  const marketer = await prisma.user.create({
    data: { email: "marketing@rebar.local", name: "Маркетолог УК", role: "uk_marketer", passwordHash, onboardedAt: new Date() },
  });

  const ulan = await prisma.store.create({
    data: {
      name: "re:bar Улан-Удэ",
      city: "Улан-Удэ",
      kind: "owned",
      format: "flagship",
      status: "open",
      openedAt: new Date("2025-03-01"),
      address: "ТРЦ Galaxy",
      legalName: "ИП Цыпылова Сарюна Баяржаповна",
    },
  });
  const irkutsk = await prisma.store.create({
    data: { name: "re:bar Иркутск", city: "Иркутск", kind: "owned", format: "standard", status: "open", openedAt: new Date("2021-06-01") },
  });

  const ulanManager = await prisma.user.create({
    data: {
      email: "ulan@rebar.local",
      name: "Управляющий Улан-Удэ",
      role: "store_manager",
      storeId: ulan.id,
      passwordHash,
      commissionPct: 2,
      onboardedAt: new Date(),
    },
  });
  await prisma.user.create({
    data: { email: "irkutsk@rebar.local", name: "Продавец Иркутск", role: "seller", storeId: irkutsk.id, passwordHash, commissionPct: 2, onboardedAt: new Date() },
  });

  // --- Розница: каталог, остатки, касса ---
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
      sellerUserId: ulanManager.id,
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

  // Демо-партнёр в запуске
  const chita = await prisma.partner.create({
    data: {
      name: "Алексей Петров",
      company: "ИП Петров А.В.",
      city: "Чита",
      phone: "+7 914 000-00-01",
      email: "partner@rebar.local",
      status: "onboarding",
      format: "standard",
      signedAt: new Date(Date.now() - 20 * 86400000),
      curatorUserId: curator.id,
    },
  });
  const chitaStore = await prisma.store.create({
    data: { name: "re:bar Чита", city: "Чита", kind: "franchise", format: "standard", status: "launch", partnerId: chita.id },
  });
  const partnerUser = await prisma.user.create({
    data: { email: "partner@rebar.local", name: "Алексей Петров", role: "partner", partnerId: chita.id, passwordHash, onboardedAt: new Date() },
  });

  const startedAt = new Date(Date.now() - 20 * 86400000);
  const project = await prisma.launchProject.create({
    data: {
      partnerId: chita.id,
      storeId: chitaStore.id,
      curatorUserId: curator.id,
      startedAt,
      targetOpenAt: new Date(startedAt.getTime() + 75 * 86400000),
      tasks: {
        create: LAUNCH_TASKS.map((t, i) => ({
          ...t,
          sortOrder: i,
          status: i < 3 ? "done" : i === 3 ? "in_progress" : "pending",
          completedAt: i < 3 ? new Date(startedAt.getTime() + (t.dueOffsetDays - 1) * 86400000) : null,
        })),
      },
    },
  });

  // Воронка
  const leadsData = [
    { name: "Ирина Смирнова", phone: "+7 902 111-22-33", city: "Красноярск", stage: "new" as const, source: "landing", note: "Смотрела презентацию, интересует Стандарт" },
    { name: "Баир Дашиев", phone: "+7 983 222-33-44", city: "Улан-Удэ", stage: "contacted" as const, source: "instagram" },
    { name: "Олег Ким", phone: "+7 914 333-44-55", city: "Хабаровск", stage: "zoom" as const, source: "landing", budget: 2500000 },
    { name: "Мария Ли", phone: "+7 924 444-55-66", city: "Владивосток", stage: "negotiation" as const, source: "referral", budget: 3000000 },
    { name: "Денис Орлов", phone: "+7 913 555-66-77", city: "Новосибирск", stage: "contract" as const, source: "yandex", budget: 4000000 },
    { name: "Алексей Петров", phone: "+7 914 000-00-01", city: "Чита", stage: "paid" as const, source: "landing", partnerId: chita.id },
    { name: "Сергей Волков", phone: "+7 950 666-77-88", city: "Томск", stage: "lost" as const, source: "avito", note: "Нет бюджета до весны" },
  ];
  for (const l of leadsData) {
    const lead = await prisma.lead.create({
      data: { ...l, ownerUserId: sales.id, utmSource: l.source === "landing" ? "yandex" : null },
    });
    await prisma.leadActivity.create({ data: { leadId: lead.id, type: "note", body: "Заявка создана", userId: sales.id } });
  }

  // Задачи
  await prisma.task.createMany({
    data: [
      { title: "Позвонить Ирине Смирновой", assigneeId: sales.id, createdById: founder.id, dueAt: new Date(Date.now() + 86400000), status: "pending" },
      { title: "Проверить план помещения Чита", assigneeId: curator.id, createdById: founder.id, partnerId: chita.id, dueAt: new Date(Date.now() - 86400000), status: "in_progress" },
      { title: "Подготовить контент-план на октябрь", assigneeId: marketer.id, createdById: founder.id, dueAt: new Date(Date.now() + 5 * 86400000) },
      { title: "Открыть расчётный счёт", assigneeId: partnerUser.id, createdById: curator.id, partnerId: chita.id, dueAt: new Date(Date.now() + 3 * 86400000) },
    ],
  });

  // Маркетинг
  const campaign = await prisma.campaign.create({
    data: { name: "Осенний набор партнёров", goal: "12 квалифицированных заявок", channel: "Яндекс Директ + Telegram", budget: 150000, startsAt: new Date(), endsAt: new Date(Date.now() + 45 * 86400000), status: "active" },
  });
  const channels = ["Telegram", "Instagram", "VK"];
  for (let i = 0; i < 9; i++) {
    await prisma.contentItem.create({
      data: {
        title: ["Почему 0% роялти", "История точки в Улан-Удэ", "Финмодель за 3 минуты", "Как выбираем локацию", "День открытия Иркутск", "Кто такой куратор", "Lendo для клиентов", "Ответы на 5 вопросов", "Приглашение на Zoom"][i],
        channel: channels[i % 3],
        rubric: ["Продукт", "Кейсы", "Цифры"][i % 3],
        publishAt: new Date(Date.now() + (i - 2) * 2 * 86400000),
        status: i < 2 ? "published" : i < 5 ? "scheduled" : "draft",
        campaignId: campaign.id,
        authorId: marketer.id,
      },
    });
  }
  await prisma.utmLink.createMany({
    data: [
      { name: "Директ · поиск", baseUrl: "https://rebar.pro", source: "yandex", medium: "cpc", campaign: "franchise_autumn", campaignId: campaign.id },
      { name: "Telegram канал", baseUrl: "https://rebar.pro", source: "telegram", medium: "social", campaign: "franchise_autumn", campaignId: campaign.id },
    ],
  });

  await prisma.notification.create({
    data: { userId: founder.id, title: "Добро пожаловать в re:bar OS", body: "База знаний импортирована, партнёр Чита в запуске.", href: "/kb" },
  });

  console.log("Seeded re:bar OS (franchise + retail)");
  console.log(`  founder  damdikdamdin@gmail.com / ${password}`);
  console.log(`  products ${iphone.code}, ${airpods.code}, ${charger.code}, ${caseProd.code}`);
  console.log(`  project  ${project.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
