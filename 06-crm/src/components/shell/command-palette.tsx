"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import type { NavItem } from "@/lib/nav";

export function CommandPalette({
  nav,
  articles,
}: {
  nav: NavItem[];
  articles: Array<{ title: string; href: string; space: string }>;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 flex-1 max-w-md items-center gap-2 rounded-md border border-border bg-card px-3 text-left text-sm text-muted-foreground hover:bg-accent"
      >
        <Search className="size-3.5" />
        <span className="flex-1 truncate">Поиск по системе и базе знаний</span>
        <kbd className="hidden rounded-sm border border-border px-1 font-mono text-[10px] sm:inline">⌘K</kbd>
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-[15vh] z-50 w-[min(640px,92vw)] -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-popover shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
            <Dialog.Title className="sr-only">Поиск</Dialog.Title>
            <Command label="Поиск" className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
              <Command.Input
                autoFocus
                placeholder="Куда перейти или что найти…"
                className="h-12 w-full border-b border-border bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
              />
              <Command.List className="max-h-[50vh] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">Ничего не найдено</Command.Empty>
                <Command.Group heading="Разделы">
                  {nav.map((n) => (
                    <Command.Item
                      key={n.href}
                      value={`${n.label} ${n.group}`}
                      onSelect={() => go(n.href)}
                      className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm data-[selected=true]:bg-accent"
                    >
                      {n.label}
                      <span className="eyebrow">{n.group}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
                <Command.Group heading="База знаний">
                  {articles.map((a) => (
                    <Command.Item
                      key={a.href}
                      value={`${a.title} ${a.space}`}
                      onSelect={() => go(a.href)}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm data-[selected=true]:bg-accent"
                    >
                      <span className="truncate">{a.title}</span>
                      <span className="eyebrow shrink-0">{a.space}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>
            </Command>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
