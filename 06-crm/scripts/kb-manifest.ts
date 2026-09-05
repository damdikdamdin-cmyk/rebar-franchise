/**
 * Карта документов репозитория → статьи базы знаний.
 * Пути относительно корня репозитория (родитель 06-crm).
 */

export type ManifestDoc = {
  space: string;
  slug: string;
  title: string;
  path: string;
  /** роли через запятую; пусто = как у пространства */
  roles?: string;
  tags?: string;
  summary?: string;
  /** для strategiya-uk: разбить по §-секциям */
  splitSections?: boolean;
};

export const MANIFEST: ManifestDoc[] = [
  // Стратегия УК — разбивается на статьи по §
  { space: "strategy", slug: "strategiya-uk", title: "Стратегия упаковки УК v1", path: "_shared/strategy/strategiya-uk-v1.txt", splitSections: true, tags: "стратегия,УК" },

  // Юрпакет
  { space: "legal", slug: "legal-readme", title: "Юрпакет: состав и порядок подписания", path: "03-crm-and-ops/legal/README.md", tags: "юрпакет" },
  { space: "legal", slug: "nda", title: "01 · NDA — соглашение о конфиденциальности", path: "03-crm-and-ops/legal/01_NDA_Соглашение_о_конфиденциальности.docx", tags: "договор,NDA" },
  { space: "legal", slug: "license-know-how", title: "02 · Лицензионный договор ноу-хау", path: "03-crm-and-ops/legal/02_Лицензионный_договор_ноу-хау.docx", tags: "договор,лицензия" },
  { space: "legal", slug: "pre-dkk", title: "03 · Предварительный договор ДКК", path: "03-crm-and-ops/legal/03_Предварительный_договор_ДКК.docx", tags: "договор,концессия" },
  { space: "legal", slug: "dkk", title: "04 · Договор коммерческой концессии", path: "03-crm-and-ops/legal/04_Договор_коммерческой_концессии.docx", tags: "договор,концессия" },
  { space: "legal", slug: "purchase-assist", title: "05 · Соглашение о содействии в закупке", path: "03-crm-and-ops/legal/05_Соглашение_о_содействии_в_закупке_REBAR.docx", tags: "договор,закупка" },
  // 06/07 .docx в репо повреждены (обрезанный zip) — используем экспорт FINAL v3.1 из Google Docs
  { space: "legal", slug: "services", title: "06 · Договор оказания услуг (FINAL v3.1)", path: "03-crm-and-ops/legal/06_Договор_оказания_услуг_FINAL_v3.1.md", tags: "договор,услуги" },
  { space: "legal", slug: "annexes", title: "07 · Приложения к договорам (FINAL v3.1)", path: "03-crm-and-ops/legal/07_Приложения_к_договорам_FINAL_v3.1.md", tags: "договор,приложения" },

  // Запуск партнёра
  { space: "launch", slug: "zapusk-metodichka", title: "Методичка запуска 60–90 дней", path: "03-crm-and-ops/launch/01_Методичка_запуска_60-90_дней.pdf", tags: "запуск,методичка" },
  { space: "launch", slug: "partner-opening-kit", title: "Пакет открытия партнёра", path: "04-marketing/plan/partner-opening-kit.md", tags: "запуск,открытие,маркетинг" },
  { space: "launch", slug: "partner-opening-day-v1", title: "День открытия D0: сценарий", path: "04-marketing/plan/partner-opening-day-v1.md", tags: "запуск,открытие" },
  { space: "launch", slug: "partner-smm-calendar", title: "SMM-календарь открытия D-14 → D+7", path: "04-marketing/plan/partner-smm-calendar-v1.md", tags: "запуск,smm" },
  { space: "launch", slug: "rehunt-campaign", title: "Re:Hunt — городской квест для точки", path: "04-marketing/plan/rehunt-campaign-v1.md", tags: "запуск,акция" },

  // Продажи франшизы
  { space: "sales", slug: "sales-scripts-faq", title: "Скрипты продаж и FAQ", path: "03-crm-and-ops/sales/01_Скрипты_продаж_и_FAQ.docx", tags: "продажи,скрипты,FAQ" },
  { space: "sales", slug: "deck-v5-1", title: "Презентация для франчайзи v5.1 — текст", path: "02-presentation/source/v5.1-content.md", tags: "продажи,презентация" },
  { space: "sales", slug: "invest-memo-v5", title: "Инвест-меморандум v5 — текст", path: "02-presentation/source/v5-content.md", tags: "продажи,презентация" },
  { space: "sales", slug: "ops-overview", title: "CRM, продажи, запуск: обзор потоков", path: "03-crm-and-ops/README.md", tags: "обзор" },

  // Маркетинг
  { space: "marketing", slug: "marketing-master-v2", title: "Маркетинг-система v2", path: "04-marketing/plan/marketing-master-v2.md", tags: "маркетинг,план" },
  { space: "marketing", slug: "marketing-plan-v1", title: "Маркетинг-план Y1 (архив v1)", path: "04-marketing/plan/marketing-plan-v1.md", tags: "маркетинг,план,архив", roles: "founder,uk_admin,uk_marketer" },
  { space: "marketing", slug: "content-plan-4w", title: "Контент-план на 4 недели", path: "04-marketing/content/content-plan-4weeks-v1.md", tags: "контент" },
  { space: "marketing", slug: "rubrics", title: "Рубрики и тон", path: "04-marketing/content/rubrics-v1.md", tags: "контент" },
  { space: "marketing", slug: "telegram-setup", title: "Оформление Telegram-канала", path: "04-marketing/content/telegram-channel-setup-v1.md", tags: "контент,telegram" },
  { space: "marketing", slug: "instagram-franchise", title: "Instagram: франшиза vs розница", path: "04-marketing/content/instagram-franchise-v1.md", tags: "контент,instagram" },
  { space: "marketing", slug: "ad-copy", title: "Тексты объявлений", path: "04-marketing/creatives/ad-copy-v1.md", tags: "креативы" },
  { space: "marketing", slug: "banner-brief", title: "ТЗ на баннеры", path: "04-marketing/creatives/banner-brief-v1.md", tags: "креативы" },
  { space: "marketing", slug: "video-scripts", title: "Видеосценарии 15–30 сек", path: "04-marketing/creatives/video-scripts-v1.md", tags: "креативы,видео" },
  { space: "marketing", slug: "analytics-setup", title: "Настройка аналитики", path: "04-marketing/analytics/analytics-setup-v1.md", tags: "аналитика", roles: "founder,uk_admin,uk_marketer" },
  { space: "marketing", slug: "goals-events", title: "Цели и события воронки", path: "04-marketing/analytics/goals-events-v1.md", tags: "аналитика", roles: "founder,uk_admin,uk_marketer,uk_sales" },
  { space: "marketing", slug: "utm-guide", title: "UTM-схема", path: "04-marketing/analytics/utm-guide-v1.md", tags: "аналитика,utm", roles: "founder,uk_admin,uk_marketer" },
  { space: "marketing", slug: "dashboard-spec", title: "Спека дашборда KPI", path: "04-marketing/analytics/dashboard-spec-v1.md", tags: "аналитика", roles: "founder,uk_admin,uk_marketer" },
  { space: "marketing", slug: "weekly-report", title: "Шаблон еженедельного отчёта", path: "04-marketing/analytics/weekly-report-template.md", tags: "аналитика,отчёт", roles: "founder,uk_admin,uk_marketer" },
  { space: "marketing", slug: "retail-marketing-kb", title: "Маркетинговая стратегия розницы re:bar", path: "04-marketing/knowledge-base/rebar-marketing-strategy-kb.md", tags: "розница,маркетинг", roles: "founder,uk_admin,uk_marketer,uk_curator,partner,store_manager" },

  // Розница и операции
  { space: "retail", slug: "chek-list-rabochego-dnya", title: "Чек-лист рабочего дня: продавец и старший смены", path: "03-crm-and-ops/launch/02_Чек-лист_рабочего_дня_продавец_и_старший_смены.docx", tags: "розница,смена" },
  { space: "retail", slug: "cutover-hub", title: "Переход с LiveSklad на Hub: чеклист", path: "03-crm-and-ops/crm/cutover-ulan-irkutsk.md", tags: "розница,hub", roles: "founder,uk_admin,uk_curator,store_manager" },
  { space: "retail", slug: "landing-status", title: "Лендинг и интеграция заявок", path: "01-landing/README.md", tags: "лендинг", roles: "founder,uk_admin,uk_marketer,uk_sales" },
];

export type CourseSeed = {
  slug: string;
  title: string;
  description: string;
  autoRoles: string;
  lessons: Array<{ title: string; articleSlug?: string; checklist?: string[] }>;
};

export const COURSES: CourseSeed[] = [
  {
    slug: "partner-launch",
    title: "Запуск партнёра 60–90 дней",
    description: "Что происходит от подписания до первых чеков и что зависит от вас.",
    autoRoles: "partner",
    lessons: [
      { title: "Юрпакет: что вы подписали", articleSlug: "legal-readme", checklist: ["Прочитал состав пакета", "Знаю, к кому обращаться по юридическим вопросам"] },
      { title: "Методичка запуска", articleSlug: "zapusk-metodichka", checklist: ["Понимаю 6 фаз запуска", "Знаю критический путь: помещение → аренда → ремонт", "Добавил куратора в Telegram"] },
      { title: "Пакет открытия", articleSlug: "partner-opening-kit", checklist: ["Скачал бренд-гайд", "Знаю, что готовит УК, а что я"] },
      { title: "SMM за 2 недели до открытия", articleSlug: "partner-smm-calendar", checklist: ["Создал аккаунты точки", "Согласовал первые посты с маркетологом"] },
      { title: "День открытия", articleSlug: "partner-opening-day-v1", checklist: ["Назначена дата D0", "Куратор подтвердил выезд"] },
      { title: "Маркетинг розницы после открытия", articleSlug: "retail-marketing-kb", checklist: ["Понимаю УЦП и каналы точки"] },
    ],
  },
  {
    slug: "seller-day",
    title: "Рабочий день продавца",
    description: "Стандарт смены, открытие и закрытие, работа с клиентом.",
    autoRoles: "seller,store_manager",
    lessons: [
      { title: "Чек-лист смены", articleSlug: "chek-list-rabochego-dnya", checklist: ["Знаю порядок открытия точки", "Знаю порядок закрытия и сдачи кассы", "Понимаю зоны ответственности старшего смены"] },
      { title: "Стандарты продаж и сервиса", articleSlug: "retail-marketing-kb", checklist: ["Знаю УЦП re:bar", "Умею предлагать Lendo"] },
      { title: "Работа в Hub", articleSlug: "cutover-hub", checklist: ["Умею пробить продажу с S/N", "Умею оформить возврат"] },
    ],
  },
  {
    slug: "franchise-sales",
    title: "Продажа франшизы",
    description: "Воронка УК: квалификация, презентация, дожим, договор.",
    autoRoles: "uk_sales",
    lessons: [
      { title: "Стратегия: отдел продаж", articleSlug: "strategiya-uk-08", checklist: ["Знаю стадии воронки", "Знаю офер и промо для первых партнёров"] },
      { title: "Скрипты и FAQ", articleSlug: "sales-scripts-faq", checklist: ["Прошёл скрипт первого звонка", "Знаю ответы на 20 вопросов FAQ"] },
      { title: "Презентация v5.1", articleSlug: "deck-v5-1", checklist: ["Могу провести Zoom по слайдам"] },
      { title: "Юрпакет для менеджера", articleSlug: "legal-readme", checklist: ["Знаю порядок подписания: NDA → лицензия → услуги"] },
    ],
  },
  {
    slug: "opening-marketing",
    title: "Открытие точки: маркетинг",
    description: "Что делает УК и партнёр в маркетинге до и после открытия.",
    autoRoles: "uk_marketer,partner",
    lessons: [
      { title: "Маркетинг-система v2", articleSlug: "marketing-master-v2" },
      { title: "Пакет открытия", articleSlug: "partner-opening-kit" },
      { title: "SMM-календарь", articleSlug: "partner-smm-calendar" },
      { title: "Re:Hunt", articleSlug: "rehunt-campaign" },
      { title: "UTM и аналитика", articleSlug: "utm-guide" },
    ],
  },
  {
    slug: "curator-basics",
    title: "Куратор запуска: база",
    description: "Гантт, RACI, аудит локации, сопровождение после открытия.",
    autoRoles: "uk_curator",
    lessons: [
      { title: "Отдел запуска в стратегии", articleSlug: "strategiya-uk-09" },
      { title: "Методичка запуска", articleSlug: "zapusk-metodichka" },
      { title: "Чек-лист рабочего дня точки", articleSlug: "chek-list-rabochego-dnya" },
      { title: "Переход точки на Hub", articleSlug: "cutover-hub" },
    ],
  },
];
