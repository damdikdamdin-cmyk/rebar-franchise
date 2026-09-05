import type { Role } from "@prisma/client";
import {
  canAccessLaunches,
  canAccessMarketing,
  canAccessPipeline,
  canManageTeam,
  isUk,
  STORE_ROLES,
} from "@/lib/access";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  group: "Работа" | "Знания" | "Сеть" | "Настройки";
  hint?: string;
};

export function navFor(role: Role): NavItem[] {
  const items: NavItem[] = [{ href: "/", label: "Главная", icon: "home", group: "Работа" }];

  if (canAccessPipeline(role)) items.push({ href: "/pipeline", label: "Воронка", icon: "funnel", group: "Работа" });
  if (canAccessLaunches(role)) items.push({ href: "/launches", label: "Запуски", icon: "rocket", group: "Работа" });
  items.push({ href: "/tasks", label: "Задачи", icon: "check", group: "Работа" });
  if (canAccessMarketing(role)) items.push({ href: "/marketing", label: "Маркетинг", icon: "megaphone", group: "Работа" });
  if (STORE_ROLES.includes(role)) items.push({ href: "/day", label: "Рабочий день", icon: "sun", group: "Работа" });

  items.push({ href: "/kb", label: "База знаний", icon: "book", group: "Знания" });
  items.push({ href: "/learn", label: "Обучение", icon: "graduation", group: "Знания" });

  if (isUk(role)) items.push({ href: "/network", label: "Сводка сети", icon: "chart", group: "Сеть" });
  if (isUk(role)) items.push({ href: "/partners", label: "Партнёры", icon: "users", group: "Сеть" });
  items.push({ href: "/stores", label: "Точки", icon: "store", group: "Сеть" });
  if (canManageTeam(role) || role === "partner" || role === "uk_curator")
    items.push({ href: "/team", label: "Команда", icon: "team", group: "Настройки" });

  return items;
}
