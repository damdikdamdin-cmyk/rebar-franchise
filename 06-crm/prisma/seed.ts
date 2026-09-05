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
  { slug: "retail", name: "Розница и операции", icon: "store", description: "Рабочий день точки, стандарты, переход на Hub.", visibleRoles: "", sortOrder: 6 },
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
    data: { name: "re:bar Улан-Удэ", city: "Улан-Удэ", kind: "owned", format: "flagship", status: "open", openedAt: new Date("2025-03-01"), address: "ТРЦ Galaxy" },
  });
  const irkutsk = await prisma.store.create({
    data: { name: "re:bar Иркутск", city: "Иркутск", kind: "owned", format: "standard", status: "open", openedAt: new Date("2021-06-01") },
  });

  await prisma.user.create({
    data: { email: "ulan@rebar.local", name: "Управляющий Улан-Удэ", role: "store_manager", storeId: ulan.id, passwordHash, onboardedAt: new Date() },
  });
  await prisma.user.create({
    data: { email: "irkutsk@rebar.local", name: "Продавец Иркутск", role: "seller", storeId: irkutsk.id, passwordHash, onboardedAt: new Date() },
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

  console.log("Seeded re:bar OS");
  console.log(`  founder  damdikdamdin@gmail.com / ${password}`);
  console.log(`  project  ${project.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
