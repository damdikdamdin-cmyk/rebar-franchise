import type { Role } from "@prisma/client";
import type { SessionUser } from "@/lib/access";
import { isAdmin, isUk } from "@/lib/access";

/** Ключи прав розницы OS (подмножество LiveSklad). */
export const PERMISSION_KEYS = [
  "sales.delete",
  "sales.seeCustomer",
  "sales.editPrice",
  "sales.discount",
  "prices.seePurchase",
  "prices.seeProfit",
  "prices.editCatalog",
  "stock.view",
  "receipts.view",
  "receipts.create",
  "receipts.edit",
  "receipts.delete",
  "transfers.view",
  "transfers.create",
  "transfers.edit",
  "transfers.delete",
  "returns.view",
  "returns.create",
  "returns.edit",
  "returns.delete",
  "inventory.view",
  "inventory.create",
  "inventory.edit",
  "inventory.delete",
  "writeoffs.view",
  "writeoffs.create",
  "writeoffs.edit",
  "writeoffs.delete",
  "cash.seeBalance",
  "cash.operate",
  "cash.manageRegisters",
  "payroll.view",
  "payroll.pay",
  "payroll.settings",
  "schedule.manage",
  "export.data",
  "settings.access",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type PermissionMap = Partial<Record<PermissionKey, boolean>>;

export type PermissionSection = {
  id: string;
  label: string;
  keys: { key: PermissionKey; label: string }[];
};

export const PERMISSION_SECTIONS: PermissionSection[] = [
  {
    id: "sales",
    label: "Продажи",
    keys: [
      { key: "sales.delete", label: "Может удалять чеки" },
      { key: "sales.seeCustomer", label: "Может видеть покупателя" },
      { key: "sales.editPrice", label: "Может редактировать цену в чеке" },
      { key: "sales.discount", label: "Может делать скидку/наценку" },
    ],
  },
  {
    id: "prices",
    label: "Цены",
    keys: [
      { key: "prices.seePurchase", label: "Может видеть закупочный ценник" },
      { key: "prices.seeProfit", label: "Может видеть валовую прибыль" },
      { key: "prices.editCatalog", label: "Может редактировать цены в справочнике" },
    ],
  },
  {
    id: "stock",
    label: "Склад",
    keys: [
      { key: "stock.view", label: "Остатки (просмотр)" },
      { key: "receipts.view", label: "Поступления (просмотр)" },
      { key: "receipts.create", label: "Поступления · создавать" },
      { key: "receipts.edit", label: "Поступления · изменять" },
      { key: "receipts.delete", label: "Поступления · удалять" },
      { key: "transfers.view", label: "Перемещения (просмотр)" },
      { key: "transfers.create", label: "Перемещения · создавать" },
      { key: "transfers.edit", label: "Перемещения · изменять" },
      { key: "transfers.delete", label: "Перемещения · удалять" },
      { key: "returns.view", label: "Возвраты (просмотр)" },
      { key: "returns.create", label: "Возвраты · создавать" },
      { key: "returns.edit", label: "Возвраты · изменять" },
      { key: "returns.delete", label: "Возвраты · удалять" },
      { key: "inventory.view", label: "Инвентаризация (просмотр)" },
      { key: "inventory.create", label: "Инвентаризация · создавать" },
      { key: "inventory.edit", label: "Инвентаризация · изменять" },
      { key: "inventory.delete", label: "Инвентаризация · удалять" },
      { key: "writeoffs.view", label: "Списания (просмотр)" },
      { key: "writeoffs.create", label: "Списания · создавать" },
      { key: "writeoffs.edit", label: "Списания · изменять" },
      { key: "writeoffs.delete", label: "Списания · удалять" },
    ],
  },
  {
    id: "finance",
    label: "Финансы",
    keys: [
      { key: "cash.seeBalance", label: "Может видеть деньги в кассе" },
      { key: "cash.operate", label: "Доступны операции с деньгами" },
      { key: "cash.manageRegisters", label: "Может создавать, изменять, удалять кассы" },
      { key: "payroll.view", label: "Зарплата (просмотр)" },
      { key: "payroll.pay", label: "Может выплачивать зарплату" },
      { key: "payroll.settings", label: "Зарплата · настройки ставок" },
      { key: "schedule.manage", label: "График · ставить и править смены" },
    ],
  },
  {
    id: "general",
    label: "Общие",
    keys: [
      { key: "export.data", label: "Может экспортировать данные" },
      { key: "settings.access", label: "Доступ к настройкам точки" },
    ],
  },
];

export function allTrue(): PermissionMap {
  const m: PermissionMap = {};
  for (const k of PERMISSION_KEYS) m[k] = true;
  return m;
}

export function sellerDefaults(): PermissionMap {
  return {
    "sales.seeCustomer": true,
    "sales.editPrice": false,
    "sales.discount": false,
    "sales.delete": false,
    "prices.seePurchase": false,
    "prices.seeProfit": false,
    "prices.editCatalog": false,
    "stock.view": true,
    "receipts.view": true,
    "receipts.create": false,
    "receipts.edit": false,
    "receipts.delete": false,
    "transfers.view": true,
    "transfers.create": false,
    "transfers.edit": false,
    "transfers.delete": false,
    "returns.view": true,
    "returns.create": true,
    "returns.edit": false,
    "returns.delete": false,
    "inventory.view": true,
    "inventory.create": false,
    "inventory.edit": false,
    "inventory.delete": false,
    "writeoffs.view": true,
    "writeoffs.create": false,
    "writeoffs.edit": false,
    "writeoffs.delete": false,
    "cash.seeBalance": false,
    "cash.operate": false,
    "cash.manageRegisters": false,
    "payroll.view": false,
    "payroll.pay": false,
    "payroll.settings": false,
    "schedule.manage": false,
    "export.data": false,
    "settings.access": false,
  };
}

export function storeManagerDefaults(): PermissionMap {
  return {
    ...allTrue(),
    "settings.access": true,
  };
}

export function parsePermissions(raw: string | null | undefined): PermissionMap {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: PermissionMap = {};
    for (const k of PERMISSION_KEYS) {
      if (typeof obj[k] === "boolean") out[k] = obj[k];
    }
    return out;
  } catch {
    return {};
  }
}

export function serializePermissions(map: PermissionMap): string {
  const full: Record<string, boolean> = {};
  for (const k of PERMISSION_KEYS) full[k] = Boolean(map[k]);
  return JSON.stringify(full);
}

export function defaultsForSystemRole(role: Role): PermissionMap {
  if (isUk(role) || role === "partner") return allTrue();
  if (role === "store_manager") return storeManagerDefaults();
  return sellerDefaults();
}

export type UserWithAccess = SessionUser & {
  accessRole?: { permissions: string } | null;
};

/** Эффективные права: шаблон AccessRole или дефолт по системной Role. */
export function getPermissions(user: UserWithAccess): PermissionMap {
  if (isAdmin(user.role) || user.role === "uk_curator" || user.role === "partner") {
    return allTrue();
  }
  if (user.accessRole?.permissions) {
    return { ...defaultsForSystemRole(user.role), ...parsePermissions(user.accessRole.permissions) };
  }
  return defaultsForSystemRole(user.role);
}

export function can(user: UserWithAccess, key: PermissionKey): boolean {
  return Boolean(getPermissions(user)[key]);
}

export const PRESET_ROLES = [
  {
    key: "seller",
    name: "Продавец",
    homePage: "/pos",
    permissions: sellerDefaults(),
  },
  {
    key: "store_manager",
    name: "Администратор точки",
    homePage: "",
    permissions: storeManagerDefaults(),
  },
] as const;

/** Маппинг пунктов меню точки → право просмотра. */
export const NAV_PERMISSION: Record<string, PermissionKey | null> = {
  "": null,
  "/pos": null,
  "/sales": null,
  "/devices": "stock.view",
  "/orders": null,
  "/stock": "stock.view",
  "/receipts": "receipts.view",
  "/transfers": "transfers.view",
  "/returns": "returns.view",
  "/inventories": "inventory.view",
  "/writeoffs": "writeoffs.view",
  "/customers": "sales.seeCustomer",
  "/cash": "cash.seeBalance",
  "/transactions": "cash.seeBalance",
  "/cashflow": "cash.seeBalance",
  "/payroll": "payroll.view",
  "/schedule": "schedule.manage",
  "/warranty": null,
  "/reports": "export.data",
  "/audit": null, // gated by role in page
};
