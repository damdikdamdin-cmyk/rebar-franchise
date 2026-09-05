"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CheckSquare,
  Filter,
  GraduationCap,
  Home,
  LogOut,
  Megaphone,
  Rocket,
  Store,
  Sun,
  Users,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { logoutAction } from "@/actions/auth";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  funnel: Filter,
  rocket: Rocket,
  check: CheckSquare,
  megaphone: Megaphone,
  sun: Sun,
  book: BookOpen,
  graduation: GraduationCap,
  chart: BarChart3,
  users: Users,
  store: Store,
  team: UserCog,
};

export function Rail({
  nav,
  user,
}: {
  nav: NavItem[];
  user: { name: string; role: string; context: string };
}) {
  const pathname = usePathname();
  const groups = [...new Set(nav.map((n) => n.group))];

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="px-5 pb-4 pt-5">
          <Link href="/" className="display block text-2xl">
            re:bar <span className="font-mono text-[10px] not-italic tracking-[0.2em] text-sidebar-muted">OS</span>
          </Link>
          <p className="mt-2 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-sidebar-muted">
            {user.context}
          </p>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3">
          {groups.map((group) => (
            <div key={group}>
              <p className="mb-1 px-2 font-mono text-[9px] uppercase tracking-[0.18em] text-sidebar-muted">{group}</p>
              {nav
                .filter((n) => n.group === group)
                .map((item) => {
                  const Icon = ICONS[item.icon] ?? Home;
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                        active
                          ? "bg-sidebar-foreground text-sidebar"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-accent px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm">{user.name}</p>
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-sidebar-muted">{user.role}</p>
            </div>
            <div className="flex items-center gap-1">
              <ModeToggle className="rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground" />
              <form action={logoutAction}>
                <button
                  type="submit"
                  aria-label="Выйти"
                  className="rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                  <LogOut className="size-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      {/* mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-border bg-card/95 px-2 py-1 backdrop-blur lg:hidden">
        {nav.slice(0, 5).map((item) => {
          const Icon = ICONS[item.icon] ?? Home;
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em]",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
