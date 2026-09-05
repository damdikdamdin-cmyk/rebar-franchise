import type { Role } from "@prisma/client";

export const UK_ROLES: Role[] = ["founder", "uk_admin", "uk_sales", "uk_curator"];

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

export function canAccessPipeline(role: Role) {
  return isUk(role);
}

export function canAccessTeam(role: Role) {
  return role === "founder" || role === "uk_admin";
}

export function canSeeAllStores(role: Role) {
  return isUk(role);
}

export function storeWhere(user: SessionUser) {
  if (isUk(user.role)) return {};
  if (user.role === "partner" && user.partnerId) return { partnerId: user.partnerId };
  if (user.role === "seller" && user.storeId) return { id: user.storeId };
  return { id: "__none__" };
}

export function partnerWhere(user: SessionUser) {
  if (isUk(user.role)) return {};
  if (user.partnerId) return { id: user.partnerId };
  return { id: "__none__" };
}

export function assertStoreAccess(user: SessionUser, store: { id: string; partnerId: string | null }) {
  if (isUk(user.role)) return true;
  if (user.role === "partner") return store.partnerId === user.partnerId;
  if (user.role === "seller") return store.id === user.storeId;
  return false;
}

export const ROLE_LABEL: Record<Role, string> = {
  founder: "Основатель",
  uk_admin: "Админ УК",
  uk_sales: "Менеджер УК",
  uk_curator: "Куратор УК",
  partner: "Партнёр",
  seller: "Продавец",
};
