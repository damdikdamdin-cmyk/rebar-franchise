"use client";

import { useState } from "react";
import { createOrder, issueOrder, cancelOrder } from "@/actions/retail";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";
import { rub } from "@/lib/format-client";

type ProductOpt = { id: string; name: string; retailPrice: number; code: string };

export function OrderCreateForm({ storeId, products }: { storeId: string; products: ProductOpt[] }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [lines, setLines] = useState<Array<{ productId: string; name: string; qty: number; unitPrice: number }>>([]);
  const selected = products.find((p) => p.id === productId);

  return (
    <div className="space-y-3 border border-border bg-card p-4">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Новый заказ</h2>
      <p className="text-xs text-muted-foreground">
        При создании остаток сразу резервируется. Отмена вернёт товар на склад.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <select
          className="h-9 border border-input bg-background px-3 text-sm sm:col-span-2"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.name}
            </option>
          ))}
        </select>
        <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          if (!selected) return;
          setLines((prev) => [
            ...prev,
            { productId: selected.id, name: selected.name, qty, unitPrice: selected.retailPrice },
          ]);
        }}
      >
        + Позиция
      </Button>
      <ul className="text-sm">
        {lines.map((l, i) => (
          <li key={`${l.productId}-${i}`} className="flex justify-between border-b border-border py-1">
            <span>
              {l.name} × {l.qty}
            </span>
            <span className="font-mono">{rub(l.unitPrice * l.qty)}</span>
          </li>
        ))}
      </ul>
      <form action={createOrder} className="grid gap-2 sm:grid-cols-2">
        <input type="hidden" name="storeId" value={storeId} />
        <input type="hidden" name="payload" value={JSON.stringify(lines)} />
        <div>
          <Label>Клиент</Label>
          <Input name="customerName" />
        </div>
        <div>
          <Label>Телефон</Label>
          <Input name="phone" />
        </div>
        <div>
          <Label>Предоплата</Label>
          <Input name="prepaidAmount" type="number" defaultValue={0} />
        </div>
        <div>
          <Label>Комментарий</Label>
          <Input name="comment" />
        </div>
        <Button type="submit" disabled={!lines.length}>
          Создать и зарезервировать
        </Button>
      </form>
    </div>
  );
}

export function IssueOrderButton({ storeId, orderId }: { storeId: string; orderId: string }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <form action={issueOrder}>
        <input type="hidden" name="storeId" value={storeId} />
        <input type="hidden" name="orderId" value={orderId} />
        <Button type="submit" size="sm">
          Выдать
        </Button>
      </form>
      <form action={cancelOrder}>
        <input type="hidden" name="storeId" value={storeId} />
        <input type="hidden" name="orderId" value={orderId} />
        <Button type="submit" size="sm" variant="outline">
          Отменить
        </Button>
      </form>
    </div>
  );
}
