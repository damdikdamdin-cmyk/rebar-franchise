import type { ReactNode } from "react";
import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { canAccessPipeline, canAccessTeam, isUk, ROLE_LABEL, type SessionUser } from "@/lib/access";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", label: "Сводка", show: () => true },
  { href: "/pipeline", label: "Воронка", show: (u: SessionUser) => canAccessPipeline(u.role) },
  { href: "/partners", label: "Партнёры", show: (u: SessionUser) => isUk(u.role) || u.role === "partner" },
  { href: "/stores", label: "Точки", show: () => true },
  { href: "/catalog/products", label: "Товары", show: () => true },
  { href: "/settings/team", label: "Команда", show: (u: SessionUser) => canAccessTeam(u.role) },
  { href: "/settings/import", label: "Импорт", show: (u: SessionUser) => canAccessTeam(u.role) },
];

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="flex flex-col border-b border-border bg-foreground text-background lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-baseline justify-between gap-3 px-5 py-5 lg:block">
          <Link href="/" className="block">
            <span className="font-serif text-2xl italic tracking-tight">re:bar</span>
            <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.22em] opacity-60">Hub</span>
          </Link>
          <p className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-background/50 lg:mt-3 lg:block">
            сеть франшизы
          </p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3 lg:pb-0">
          {NAV.filter((item) => item.show(user)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-background/70 hover:bg-background/10 hover:text-background"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-background/15 px-5 py-4 lg:block">
          <p className="text-sm">{user.name}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-background/50">
            {ROLE_LABEL[user.role]}
          </p>
        </div>
      </aside>
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-end gap-2 border-b border-border px-4 py-3">
          <span className="mr-auto font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground lg:hidden">
            {ROLE_LABEL[user.role]}
          </span>
          <ModeToggle />
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Выйти
            </Button>
          </form>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
