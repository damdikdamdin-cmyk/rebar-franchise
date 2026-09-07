import { BrandMark } from "@/components/brand-mark";
import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="relative z-10 flex items-center justify-between">
          <BrandMark className="display text-3xl" />
          <span className="eyebrow text-sidebar-muted">OS · закрытая сеть</span>
        </div>
        <div className="relative z-10 max-w-md">
          <p className="eyebrow text-sidebar-muted">Одна система на всю сеть</p>
          <h1 className="display mt-3 text-6xl">
            УК, партнёры, точки и знания — <span className="text-sidebar-muted">в одном контуре.</span>
          </h1>
          <p className="mt-6 text-sm leading-relaxed text-sidebar-muted">
            Воронка и запуск партнёра, база знаний по направлениям, обучение сотрудников и сводка сети. Доступ только по
            приглашению УК.
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-6 font-mono text-[10px] uppercase tracking-[0.14em] text-sidebar-muted">
          <span>Улан-Удэ</span>
          <span>Иркутск</span>
          <span>+ партнёры</span>
        </div>
        <div className="pointer-events-none absolute -right-40 -top-40 size-[520px] rounded-full border border-sidebar-accent" />
        <div className="pointer-events-none absolute -bottom-52 -left-20 size-[480px] rounded-full border border-sidebar-accent" />
      </aside>
      <main className="flex items-center justify-center px-6 py-12">{children}</main>
    </div>
  );
}
