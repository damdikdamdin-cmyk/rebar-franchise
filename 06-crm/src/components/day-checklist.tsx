"use client";

import { Check } from "lucide-react";
import { Card } from "@/components/ui/fields";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/lib/use-local-storage";

type State = { date: string; checked: number[] };

function parse(raw: string | null, today: string): Set<number> {
  if (!raw) return new Set();
  try {
    const s = JSON.parse(raw) as State;
    return s.date === today ? new Set(s.checked) : new Set();
  } catch {
    return new Set();
  }
}

export function DayChecklist({ storageKey, opening, closing, today }: { storageKey: string; opening: string[]; closing: string[]; today: string }) {
  const [raw, save] = useLocalStorage(storageKey);
  const checked = parse(raw, today);

  function toggle(i: number) {
    const next = new Set(checked);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    save(JSON.stringify({ date: today, checked: [...next] } satisfies State));
  }

  const all = [...opening, ...closing];
  const pct = Math.round((checked.size / all.length) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-foreground transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="font-mono text-xs">
          {checked.size}/{all.length}
        </span>
      </div>
      {[
        { title: "Открытие", items: opening, offset: 0 },
        { title: "Закрытие", items: closing, offset: opening.length },
      ].map((g) => (
        <div key={g.title}>
          <p className="eyebrow mb-2">{g.title}</p>
          <Card className="divide-y divide-border">
            {g.items.map((item, i) => {
              const idx = g.offset + i;
              const on = checked.has(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggle(idx)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-accent"
                >
                  <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-sm border border-border", on && "bg-foreground text-background")}>
                    {on ? <Check className="size-3.5" /> : null}
                  </span>
                  <span className={cn(on && "text-muted-foreground line-through")}>{item}</span>
                </button>
              );
            })}
          </Card>
        </div>
      ))}
    </div>
  );
}
