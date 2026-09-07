"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type PrintAction = { key: string; label: string; href: string };

export function PrintActions({ actions, label = "Печать" }: { actions: PrintAction[]; label?: string }) {
  const [open, setOpen] = useState(false);
  if (!actions.length) return null;
  if (actions.length === 1) {
    return (
      <Link
        href={actions[0].href}
        target="_blank"
        className="inline-flex border border-border bg-foreground px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-background"
      >
        {actions[0].label}
      </Link>
    );
  }
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="border border-border bg-foreground px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-background"
      >
        {label} ▾
      </button>
      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="Закрыть" onClick={() => setOpen(false)} />
          <ul className="absolute right-0 z-20 mt-1 min-w-[200px] border border-border bg-card py-1 shadow-lg">
            {actions.map((a) => (
              <li key={a.key}>
                <Link
                  href={a.href}
                  target="_blank"
                  className={cn("block px-3 py-2 text-sm hover:bg-accent")}
                  onClick={() => setOpen(false)}
                >
                  {a.label}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
