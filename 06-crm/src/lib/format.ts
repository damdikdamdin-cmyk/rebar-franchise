import type { LeadStage, StoreFormat, StoreKind, StoreStatus, PartnerStatus, LaunchStatus, TaskStatus, ContentStatus, CampaignStatus, ArticleStatus } from "@prisma/client";

export function rub(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";
}

export function shortDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));
}

export function dateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

export function relativeDays(d: Date | string | null | undefined) {
  if (!d) return "";
  const diff = Math.round((new Date(d).getTime() - Date.now()) / 86400000);
  if (diff === 0) return "сегодня";
  if (diff === 1) return "завтра";
  if (diff === -1) return "вчера";
  return diff > 0 ? `через ${diff} дн` : `${-diff} дн назад`;
}

export function addDays(d: Date, days: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export const LEAD_STAGES: { id: LeadStage; label: string }[] = [
  { id: "new", label: "Заявка" },
  { id: "contacted", label: "Контакт" },
  { id: "qualified", label: "Квалификация" },
  { id: "zoom", label: "Zoom" },
  { id: "negotiation", label: "Дожим" },
  { id: "contract", label: "Договор" },
  { id: "paid", label: "Оплата" },
  { id: "lost", label: "Отказ" },
];

export const LEAD_STAGE_LABEL = Object.fromEntries(LEAD_STAGES.map((s) => [s.id, s.label])) as Record<LeadStage, string>;

export const FORMAT_LABEL: Record<StoreFormat, string> = {
  flagship: "Флагман",
  standard: "Стандарт",
  pickup: "Пункт выдачи",
};

export const KIND_LABEL: Record<StoreKind, string> = {
  owned: "Собственная",
  franchise: "Франшиза",
};

export const STORE_STATUS_LABEL: Record<StoreStatus, string> = {
  launch: "Запуск",
  open: "Открыта",
  closed: "Закрыта",
};

export const PARTNER_STATUS_LABEL: Record<PartnerStatus, string> = {
  onboarding: "Запуск",
  active: "Работает",
  paused: "Пауза",
};

export const LAUNCH_STATUS_LABEL: Record<LaunchStatus, string> = {
  active: "В работе",
  opened: "Открыта",
  paused: "Пауза",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Ждёт",
  in_progress: "В работе",
  done: "Готово",
  skipped: "Пропуск",
};

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  idea: "Идея",
  draft: "Черновик",
  scheduled: "Запланировано",
  published: "Опубликовано",
};

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  planned: "План",
  active: "Идёт",
  finished: "Завершена",
};

export const ARTICLE_STATUS_LABEL: Record<ArticleStatus, string> = {
  draft: "Черновик",
  published: "Опубликована",
  archived: "Архив",
};

export const CHANNELS = ["Telegram", "Instagram", "VK", "Яндекс Директ", "Avito", "Сайт", "Email", "Офлайн"];
