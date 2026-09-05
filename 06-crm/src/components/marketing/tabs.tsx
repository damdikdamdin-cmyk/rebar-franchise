"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/marketing", label: "Календарь" },
  { href: "/marketing/campaigns", label: "Кампании" },
  { href: "/marketing/utm", label: "UTM" },
  { href: "/marketing/analytics", label: "Аналитика" },
  { href: "/kb/space/marketing", label: "База знаний ↗" },
];

export function MarketingTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1">
      {TABS.map((t) => {
        const active = t.href === "/marketing" ? pathname === "/marketing" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn("rounded-sm px-3 py-1.5 text-xs", active ? "bg-foreground text-background" : "hover:bg-accent")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
