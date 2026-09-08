"use client";

import { useMemo, useState } from "react";
import { finishInventory } from "@/actions/retail";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";
import { rub } from "@/lib/format-client";
import { cn } from "@/lib/utils";

export type InventoryRow = {
  key: string;
  productId: string;
  name: string;
  code: string;
  qtyAccount: number;
  purchasePrice: number;
  retailPrice: number;
  serial?: string;
  serialTracked: boolean;
};

type Mark = "unchecked" | "ok" | "missing";

export function InventoryWorkspace({
  storeId,
  rows,
  doneId,
}: {
  storeId: string;
  rows: InventoryRow[];
  doneId?: string;
}) {
  const [started, setStarted] = useState(false);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [query, setQuery] = useState("");
  const [extraKeys, setExtraKeys] = useState<string[]>([]);

  const allRows = useMemo(() => {
    const base = rows;
    const extras = extraKeys
      .map((k) => rows.find((r) => r.key === k))
      .filter(Boolean) as InventoryRow[];
    const map = new Map<string, InventoryRow>();
    for (const r of [...base, ...extras]) map.set(r.key, r);
    return [...map.values()];
  }, [rows, extraKeys]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return rows
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          (r.serial ?? "").toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [query, rows]);

  const visible = useMemo(() => {
    if (!started) return allRows;
    const q = query.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        (r.serial ?? "").toLowerCase().includes(q),
    );
  }, [allRows, query, started]);

  function setMark(key: string, mark: Mark) {
    setMarks((prev) => ({ ...prev, [key]: prev[key] === mark ? "unchecked" : mark }));
  }

  const stats = useMemo(() => {
    let devices = 0;
    let costBook = 0;
    let retailBook = 0;
    let costOk = 0;
    let retailOk = 0;
    let missingQty = 0;
    let missingCost = 0;
    let missingRetail = 0;
    let checked = 0;

    for (const r of allRows) {
      const units = r.qtyAccount;
      devices += units;
      costBook += r.purchasePrice * units;
      retailBook += r.retailPrice * units;
      const m = marks[r.key] ?? "unchecked";
      if (m === "ok") {
        checked += 1;
        costOk += r.purchasePrice * units;
        retailOk += r.retailPrice * units;
      } else if (m === "missing") {
        checked += 1;
        missingQty += units;
        missingCost += r.purchasePrice * units;
        missingRetail += r.retailPrice * units;
      }
    }
    return { devices, costBook, retailBook, costOk, retailOk, missingQty, missingCost, missingRetail, checked };
  }, [allRows, marks]);

  const payload = useMemo(() => {
    return allRows.map((r) => {
      const m = marks[r.key] ?? "unchecked";
      const qtyActual = m === "ok" ? r.qtyAccount : m === "missing" ? 0 : r.qtyAccount;
      return {
        productId: r.productId,
        name: r.name,
        qtyAccount: r.qtyAccount,
        qtyActual,
        price: r.purchasePrice,
        retailPrice: r.retailPrice,
        serial: r.serial,
      };
    });
  }, [allRows, marks]);

  function addFromSuggest(r: InventoryRow) {
    setExtraKeys((prev) => (prev.includes(r.key) ? prev : [...prev, r.key]));
    setQuery(r.name);
  }

  return (
    <div className="space-y-6">
      {doneId ? (
        <div className="border border-border bg-card px-4 py-3 text-sm">
          Инвентаризация проведена · документ сохранён
        </div>
      ) : null}

      <section className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Устройств / шт.</p>
          <p className="mt-1 font-mono text-xl">{stats.devices}</p>
        </div>
        <div className="bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Себестоимость на остатках</p>
          <p className="mt-1 font-mono text-xl">{rub(stats.costBook)}</p>
        </div>
        <div className="bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Розница на остатках</p>
          <p className="mt-1 font-mono text-xl">{rub(stats.retailBook)}</p>
        </div>
        <div className="bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Не хватает</p>
          <p className="mt-1 font-mono text-xl">{stats.missingQty}</p>
          <p className="font-mono text-[10px] text-muted-foreground">
            закуп {rub(stats.missingCost)} · розн {rub(stats.missingRetail)}
          </p>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setStarted(true);
            setMarks({});
          }}
          className={cn(
            "border px-4 py-6 text-left",
            started ? "border-foreground bg-foreground text-background" : "border-border bg-card",
          )}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.14em]">Начать инвентаризацию</p>
          <p className="mt-2 text-sm opacity-80">Загрузить остатки точки и отмечать позиции</p>
        </button>
        <form action={finishInventory}>
          <input type="hidden" name="storeId" value={storeId} />
          <input type="hidden" name="payload" value={JSON.stringify(payload)} />
          <input type="hidden" name="comment" value="Инвентаризация точки" />
          <button
            type="submit"
            disabled={!started || stats.checked === 0}
            className="h-full w-full border border-border bg-card px-4 py-6 text-left disabled:opacity-40"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.14em]">Закончить инвентаризацию</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Создать документ расхождений · отмечено {stats.checked}/{allRows.length}
            </p>
          </button>
        </form>
      </div>

      <div className="relative">
        <Label>Товар (поиск по остаткам)</Label>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Название, код или IMEI"
          disabled={!started && allRows.length === 0}
        />
        {suggestions.length && query.trim() ? (
          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto border border-border bg-card text-sm shadow">
            {suggestions.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left hover:bg-accent"
                  onClick={() => addFromSuggest(r)}
                >
                  <span className="font-mono text-[10px] text-muted-foreground">{r.code}</span> · {r.name}
                  {r.serial ? ` · ${r.serial}` : ` · ${r.qtyAccount} шт.`}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {!started ? (
        <p className="text-sm text-muted-foreground">Нажмите «Начать инвентаризацию», чтобы отметить остатки.</p>
      ) : (
        <div className="overflow-x-auto border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2">Товар</th>
                <th className="px-3 py-2">Учёт</th>
                <th className="px-3 py-2">Закуп</th>
                <th className="px-3 py-2">Розница</th>
                <th className="px-3 py-2 text-center">✓ / ×</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const m = marks[r.key] ?? "unchecked";
                return (
                  <tr key={r.key} className="border-b border-border">
                    <td className="px-3 py-2">
                      <div>{r.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {r.code}
                        {r.serial ? ` · IMEI ${r.serial}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono">{r.qtyAccount}</td>
                    <td className="px-3 py-2 font-mono">{rub(r.purchasePrice * r.qtyAccount)}</td>
                    <td className="px-3 py-2 font-mono">{rub(r.retailPrice * r.qtyAccount)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          aria-label="Найдено"
                          onClick={() => setMark(r.key, "ok")}
                          className={cn(
                            "flex size-8 items-center justify-center border text-base",
                            m === "ok" ? "border-green-700 bg-green-600 text-white" : "border-border",
                          )}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          aria-label="Не найдено"
                          onClick={() => setMark(r.key, "missing")}
                          className={cn(
                            "flex size-8 items-center justify-center border text-base",
                            m === "missing" ? "border-red-700 bg-red-600 text-white" : "border-border",
                          )}
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!visible.length ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                    На остатках этой точки пусто — сначала сделайте поступление
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {started && stats.missingQty > 0 ? (
        <section className="border border-red-200 bg-card p-4">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-red-600">Не хватает по остаткам</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {allRows
              .filter((r) => marks[r.key] === "missing")
              .map((r) => (
                <li key={r.key} className="flex justify-between gap-2 border-b border-border py-1">
                  <span>
                    {r.name}
                    {r.serial ? ` · ${r.serial}` : ""} × {r.qtyAccount}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    закуп {rub(r.purchasePrice * r.qtyAccount)} · розн {rub(r.retailPrice * r.qtyAccount)}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
