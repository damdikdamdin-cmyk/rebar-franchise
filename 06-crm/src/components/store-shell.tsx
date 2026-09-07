import Link from "next/link";
import type { ReactNode } from "react";

const MODULES = [
  { href: "", label: "Обзор", match: "exact" },
  { href: "/pos", label: "Продажи" },
  { href: "/orders", label: "Заказы" },
  { href: "/stock", label: "Остатки" },
  { href: "/receipts", label: "Поступления" },
  { href: "/transfers", label: "Перемещения" },
  { href: "/returns", label: "Возвраты" },
  { href: "/inventories", label: "Инвентаризации" },
  { href: "/writeoffs", label: "Списания" },
  { href: "/customers", label: "Клиенты" },
  { href: "/cash", label: "Кассы" },
  { href: "/transactions", label: "Транзакции" },
  { href: "/cashflow", label: "Денежный поток" },
  { href: "/payroll", label: "Зарплата" },
  { href: "/warranty", label: "Гарантии" },
  { href: "/reports", label: "Отчёты" },
] as const;

export function StoreShell({
  storeId,
  storeName,
  city,
  pathname,
  children,
}: {
  storeId: string;
  storeName: string;
  city: string;
  pathname: string;
  children: ReactNode;
}) {
  const base = `/stores/${storeId}`;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <Link href="/stores" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            ← Точки
          </Link>
          <h1 className="mt-1 font-serif text-3xl">
            {city} <span className="text-muted-foreground">·</span> {storeName}
          </h1>
        </div>
        <Link
          href="/catalog/products"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground underline"
        >
          Справочник товаров
        </Link>
      </div>
      <div className="lg:grid lg:grid-cols-[180px_1fr] lg:gap-6">
        <nav className="mb-4 flex gap-1 overflow-x-auto lg:mb-0 lg:flex-col">
          {MODULES.map((item) => {
            const href = `${base}${item.href}`;
            const active =
              "match" in item && item.match === "exact"
                ? pathname === base || pathname === `${base}/`
                : pathname.startsWith(href) && item.href !== "";
            const exactActive = item.href === "" && (pathname === base || pathname === `${base}/`);
            const isOn = item.href === "" ? exactActive : active;
            return (
              <Link
                key={href}
                href={href}
                className={`shrink-0 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] ${
                  isOn ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div>{children}</div>
      </div>
    </div>
  );
}
