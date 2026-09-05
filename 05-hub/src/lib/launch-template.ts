export type LaunchTaskSeed = {
  code: string;
  title: string;
  phase: string;
  ownerRole: string;
  dueOffsetDays: number;
};

export const LAUNCH_TASKS: LaunchTaskSeed[] = [
  { code: "kickoff", title: "Kick-off и передача пакета", phase: "Старт", ownerRole: "Куратор УК", dueOffsetDays: 3 },
  { code: "ip", title: "Регистрация ИП и расчётный счёт", phase: "Старт", ownerRole: "Партнёр", dueOffsetDays: 10 },
  { code: "location", title: "Поиск помещения", phase: "Локация", ownerRole: "Партнёр + куратор", dueOffsetDays: 25 },
  { code: "audit", title: "Аудит и утверждение локации", phase: "Локация", ownerRole: "Куратор УК", dueOffsetDays: 28 },
  { code: "lease", title: "Договор аренды", phase: "Локация", ownerRole: "Партнёр + юрист", dueOffsetDays: 33 },
  { code: "design", title: "Дизайн и техплан", phase: "Проект", ownerRole: "Дизайнер УК", dueOffsetDays: 36 },
  { code: "demo", title: "Ремонт: демонтаж и черновые", phase: "Ремонт", ownerRole: "Партнёр + подрядчик", dueOffsetDays: 45 },
  { code: "finish", title: "Ремонт: электрика и чистовая", phase: "Ремонт", ownerRole: "Партнёр + подрядчик", dueOffsetDays: 52 },
  { code: "branding", title: "Брендирование: вывеска и неон", phase: "Ремонт", ownerRole: "Куратор + подрядчик", dueOffsetDays: 56 },
  { code: "stock", title: "Закуп стартового ассортимента", phase: "Открытие", ownerRole: "Закупщик УК", dueOffsetDays: 57 },
  { code: "legal", title: "Касса, эквайринг, Lendo, учёт", phase: "Открытие", ownerRole: "Партнёр + юрист", dueOffsetDays: 58 },
  { code: "training", title: "Обучение персонала", phase: "Открытие", ownerRole: "Тренер УК", dueOffsetDays: 60 },
  { code: "marketing", title: "Маркетинг ramp-up", phase: "Открытие", ownerRole: "Маркетолог УК", dueOffsetDays: 65 },
  { code: "open", title: "День открытия", phase: "Открытие", ownerRole: "Куратор УК", dueOffsetDays: 60 },
  { code: "daily", title: "Ежедневный аудит после открытия", phase: "Сопровождение", ownerRole: "Куратор УК", dueOffsetDays: 74 },
  { code: "weekly", title: "Еженедельный кураторский аудит", phase: "Сопровождение", ownerRole: "Куратор УК", dueOffsetDays: 90 },
];
