"use client";

import { useMemo, useState } from "react";
import type { StockDocType } from "@prisma/client";
import { createStockDoc } from "@/actions/retail";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";
import { rub } from "@/lib/format-client";

type ProductOpt = { id: string; code: string; name: string; purchasePrice: number; retailPrice: number; qty: number };

export function StockDocForm({
  storeId,
  type,
  products,
  stores = [],
  suppliers = [],
  title,
}: {
  storeId: string;
  type: StockDocType;
  products: ProductOpt[];
  stores?: Array<{ id: string; city: string; name: string }>;
  suppliers?: Array<{ id: string; name: string }>;
  title: string;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(products[0]?.purchasePrice ?? 0);
  const [serial, setSerial] = useState("");
  const [qtyActual, setQtyActual] = useState(0);
  const [lines, setLines] = useState<
    Array<{ productId: string; name: string; qty: number; price: number; serial?: string; qtyAccount?: number; qtyActual?: number }>
  >([]);

  const selected = useMemo(() => products.find((p) => p.id === productId), [products, productId]);

  function addLine() {
    if (!selected || qty <= 0) return;
    setLines((prev) => [
      ...prev,
      {
        productId: selected.id,
        name: selected.name,
        qty: type === "inventory" ? qtyActual : qty,
        price,
        serial: serial || undefined,
        qtyAccount: type === "inventory" ? selected.qty : undefined,
        qtyActual: type === "inventory" ? qtyActual : undefined,
      },
    ]);
    setSerial("");
  }

  const total = lines.reduce((s, l) => s + l.price * (type === "inventory" ? 0 : l.qty), 0);

  return (
    <div className="space-y-4 border border-border bg-card p-4">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Label>Товар</Label>
          <select
            className="mt-1 flex h-9 w-full border border-input bg-background px-3 text-sm"
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              const p = products.find((x) => x.id === e.target.value);
              if (p) {
                setPrice(type === "receipt" || type === "supplier_return" ? p.purchasePrice : p.retailPrice);
                setQtyActual(p.qty);
              }
            }}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name} ({p.qty})
              </option>
            ))}
          </select>
        </div>
        {type === "inventory" ? (
          <div>
            <Label>Факт</Label>
            <Input type="number" value={qtyActual} onChange={(e) => setQtyActual(Number(e.target.value) || 0)} />
          </div>
        ) : (
          <div>
            <Label>Кол-во</Label>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} />
          </div>
        )}
        <div>
          <Label>Цена</Label>
          <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} />
        </div>
        <div>
          <Label>S/N</Label>
          <Input value={serial} onChange={(e) => setSerial(e.target.value)} />
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addLine}>
        + Добавить строку
      </Button>
      <ul className="space-y-1 text-sm">
        {lines.map((l, i) => (
          <li key={`${l.productId}-${i}`} className="flex justify-between border-b border-border py-2">
            <span>
              {l.name} × {type === "inventory" ? `учёт ${l.qtyAccount} / факт ${l.qtyActual}` : l.qty}
              {l.serial ? ` · ${l.serial}` : ""}
            </span>
            <button type="button" className="font-mono text-[10px]" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>
              удалить
            </button>
          </li>
        ))}
      </ul>
      <form action={createStockDoc} className="space-y-3">
        <input type="hidden" name="storeId" value={storeId} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="payload" value={JSON.stringify(lines)} />
        <input type="hidden" name="autoPost" value="1" />
        {type === "transfer" ? (
          <div>
            <Label>Склад назначения</Label>
            <select name="toStoreId" className="mt-1 flex h-9 w-full border border-input bg-background px-3 text-sm" required>
              <option value="">Выберите</option>
              {stores
                .filter((s) => s.id !== storeId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.city} · {s.name}
                  </option>
                ))}
            </select>
          </div>
        ) : null}
        {type === "receipt" || type === "supplier_return" ? (
          <div>
            <Label>Поставщик</Label>
            <select name="supplierId" className="mt-1 flex h-9 w-full border border-input bg-background px-3 text-sm" defaultValue="__none__">
              <option value="__none__">Не указан</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {(type === "receipt" || type === "customer_return") && (
          <div>
            <Label>Оплачено сейчас, ₽</Label>
            <Input name="paidAmount" type="number" defaultValue={type === "receipt" ? total : total} />
          </div>
        )}
        <div>
          <Label>Комментарий</Label>
          <Input name="comment" />
        </div>
        <Button type="submit" disabled={!lines.length}>
          Создать и провести {total ? `· ${rub(total)}` : ""}
        </Button>
      </form>
    </div>
  );
}
