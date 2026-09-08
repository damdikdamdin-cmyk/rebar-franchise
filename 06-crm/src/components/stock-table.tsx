"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PrintActions } from "@/components/print/print-actions";
import { useBarcodeScanner } from "@/components/print/barcode-scanner";
import { Badge } from "@/components/ui/fields";
import { DeletedMark } from "@/components/deleted-mark";
import { softDeleteProduct } from "@/actions/retail";
import { rub } from "@/lib/format-client";
import { cn } from "@/lib/utils";

export type StockRow = {
  id: string;
  productId: string;
  name: string;
  code: string;
  barcode: string | null;
  group: string | null;
  qty: number;
  otherQty: number;
  retailPrice: number;
  minStock: number;
  deletedAt?: Date | string | null;
};

export function StockTable({
  storeId,
  rows,
  showDelete = true,
}: {
  storeId: string;
  rows: StockRow[];
  showDelete?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        r.code.toLowerCase().includes(needle) ||
        (r.barcode ?? "").includes(needle),
    );
  }, [rows, q]);

  useBarcodeScanner((code) => {
    const hit = rows.find((r) => r.barcode === code || r.code === code);
    if (hit) {
      setSelected((prev) => new Set(prev).add(hit.productId));
      setQ(code);
    } else setQ(code);
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const productsParam = [...selected].join(",");
  const printActions =
    selected.size > 0
      ? [
          { key: "big", label: "Большой ценник", href: `/print/price_big?store=${storeId}&products=${productsParam}` },
          { key: "small", label: "Маленький ценник", href: `/print/price_small?store=${storeId}&products=${productsParam}` },
          { key: "label", label: "Этикетка 43×25", href: `/print/label_43x25?store=${storeId}&products=${productsParam}` },
        ]
      : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          data-barcode-input="1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск или сканер…"
          className="h-9 min-w-[200px] flex-1 border border-border bg-background px-3 text-sm"
        />
        {selected.size ? (
          <>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">выбрано {selected.size}</span>
            <PrintActions label="Печать ценников" actions={printActions} />
            <button
              type="button"
              className="font-mono text-[10px] uppercase text-muted-foreground"
              onClick={() => setSelected(new Set())}
            >
              сбросить
            </button>
          </>
        ) : (
          <span className="font-mono text-[10px] uppercase text-muted-foreground">печать ценников</span>
        )}
      </div>
      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr className="border-b border-border text-left">
              <th className="px-3 py-3" />
              <th className="px-4 py-3">Товар</th>
              <th className="px-4 py-3">Группа</th>
              <th className="px-4 py-3">Кол-во</th>
              <th className="px-4 py-3">Другие точки</th>
              <th className="px-4 py-3">Розница</th>
              <th className="px-4 py-3">Печать</th>
              {showDelete ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr
                key={b.id}
                className={cn(
                  "border-b border-border last:border-0",
                  selected.has(b.productId) && "bg-accent/40",
                  b.deletedAt && "bg-red-50/50",
                )}
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(b.productId)}
                    onChange={() => toggle(b.productId)}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/catalog/products/${b.productId}`}
                      className={cn("hover:underline", b.deletedAt && "line-through text-muted-foreground")}
                    >
                      {b.name}
                    </Link>
                    <DeletedMark at={b.deletedAt} compact />
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    Код: {b.code}
                    {b.barcode ? ` · ${b.barcode}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{b.group ?? "—"}</td>
                <td className="px-4 py-3 font-mono">
                  {b.qty}
                  {b.qty <= b.minStock ? (
                    <Badge tone="warn" className="ml-2">
                      низкий
                    </Badge>
                  ) : null}
                </td>
                <td className="px-4 py-3 font-mono text-muted-foreground">{b.otherQty}</td>
                <td className="px-4 py-3 font-mono">{rub(b.retailPrice)}</td>
                <td className="px-4 py-3">
                  <PrintActions
                    actions={[
                      {
                        key: "b",
                        label: "Большой ценник",
                        href: `/print/price_big?store=${storeId}&product=${b.productId}`,
                      },
                      {
                        key: "s",
                        label: "Маленький ценник",
                        href: `/print/price_small?store=${storeId}&product=${b.productId}`,
                      },
                      {
                        key: "l",
                        label: "Этикетка",
                        href: `/print/label_43x25?store=${storeId}&product=${b.productId}`,
                      },
                    ]}
                  />
                </td>
                {showDelete ? (
                  <td className="px-4 py-3">
                    {!b.deletedAt ? (
                      <form action={softDeleteProduct}>
                        <input type="hidden" name="storeId" value={storeId} />
                        <input type="hidden" name="productId" value={b.productId} />
                        <button
                          type="submit"
                          className="font-mono text-[10px] uppercase text-red-600"
                          title="Удалить с остатков (мягко)"
                        >
                          ×
                        </button>
                      </form>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        Всего позиций — {filtered.length}
      </p>
    </div>
  );
}
