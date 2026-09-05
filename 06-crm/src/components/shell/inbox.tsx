"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { markAllRead } from "@/actions/inbox";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; body: string | null; href: string | null; readAt: Date | null; createdAt: Date };

export function Inbox({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  const unread = items.filter((i) => !i.readAt).length;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Уведомления"
          className="relative flex size-8 items-center justify-center rounded-md border border-border bg-card hover:bg-accent"
        >
          <Bell className="size-4" />
          {unread ? (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-foreground font-mono text-[9px] text-background">
              {unread}
            </span>
          ) : null}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/20" />
        <Dialog.Content className="fixed right-0 top-0 z-50 flex h-screen w-[min(400px,92vw)] flex-col border-l border-border bg-popover shadow-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-right-8">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Dialog.Title className="display text-2xl">Инбокс</Dialog.Title>
            {unread ? (
              <form action={markAllRead}>
                <button type="submit" className="eyebrow underline underline-offset-4">
                  Прочитать все
                </button>
              </form>
            ) : null}
          </div>
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Пока тихо.</p>
            ) : (
              items.map((n) => {
                const inner = (
                  <div className={cn("border-b border-border px-4 py-3", !n.readAt && "bg-accent/50")}>
                    <p className="text-sm">{n.title}</p>
                    {n.body ? <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p> : null}
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {new Date(n.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                );
                return n.href ? (
                  <Link key={n.id} href={n.href} onClick={() => setOpen(false)} className="block hover:bg-accent">
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                );
              })
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
