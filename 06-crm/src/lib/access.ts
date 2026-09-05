import type { Role } from "@prisma/client";

export const ALL_ROLES: Role[] = [
  "founder",
  "uk_admin",
  "uk_sales",
  "uk_curator",
  "uk_marketer",
  "partner",
  "store_manager",
  "seller",
];

export const UK_ROLES: Role[] = ["founder", "uk_admin", "uk_sales", "uk_curator", "uk_marketer"];
export const STORE_ROLES: Role[] = ["store_manager", "seller"];

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: Role;
  partnerId: string | null;
  storeId: string | null;
};

export function isUk(role: Role) {
  return UK_ROLES.includes(role);
}

export function isAdmin(role: Role) {
  return role === "founder" || role === "uk_admin";
}

export function canAccessPipeline(role: Role) {
  return isAdmin(role) || role === "uk_sales";
}

export function canAccessLaunches(role: Role) {
  return isUk(role) || role === "partner";
}

export function canAccessMarketing(role: Role) {
  return isAdmin(role) || role === "uk_marketer";
}

export function canEditKb(role: Role) {
  return isUk(role);
}

export function canManageTeam(role: Role) {
  return isAdmin(role);
}

export function canInviteToPartner(user: SessionUser, partnerId: string) {
  if (isAdmin(user.role) || user.role === "uk_curator") return true;
  return user.role === "partner" && user.partnerId === partnerId;
}

export function storeWhere(user: SessionUser) {
  if (isUk(user.role)) return {};
  if (user.role === "partner" && user.partnerId) return { partnerId: user.partnerId };
  if (STORE_ROLES.includes(user.role) && user.storeId) return { id: user.storeId };
  return { id: "__none__" };
}

export function partnerWhere(user: SessionUser) {
  if (isUk(user.role)) return {};
  if (user.partnerId) return { id: user.partnerId };
  return { id: "__none__" };
}

export function launchWhere(user: SessionUser) {
  if (isAdmin(user.role) || user.role === "uk_sales" || user.role === "uk_marketer") return {};
  if (user.role === "uk_curator") return { curatorUserId: user.id };
  if (user.partnerId) return { partnerId: user.partnerId };
  return { id: "__none__" };
}

export function assertStoreAccess(user: SessionUser, store: { id: string; partnerId: string | null }) {
  if (isUk(user.role)) return true;
  if (user.role === "partner") return store.partnerId === user.partnerId;
  if (STORE_ROLES.includes(user.role)) return store.id === user.storeId;
  return false;
}

export function parseRoles(csv: string | null | undefined): Role[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((r) => r.trim())
    .filter((r): r is Role => ALL_ROLES.includes(r as Role));
}

export function roleCanSee(role: Role, csv: string | null | undefined) {
  if (isAdmin(role)) return true;
  const roles = parseRoles(csv);
  return roles.length === 0 || roles.includes(role);
}

export const ROLE_LABEL: Record<Role, string> = {
  founder: "Основатель",
  uk_admin: "Админ УК",
  uk_sales: "Менеджер продаж УК",
  uk_curator: "Куратор запуска",
  uk_marketer: "Маркетолог УК",
  partner: "Партнёр",
  store_manager: "Управляющий точкой",
  seller: "Продавец",
};

export const ROLE_SHORT: Record<Role, string> = {
  founder: "УК",
  uk_admin: "УК",
  uk_sales: "Продажи",
  uk_curator: "Куратор",
  uk_marketer: "Маркетинг",
  partner: "Партнёр",
  store_manager: "Точка",
  seller: "Точка",
};
