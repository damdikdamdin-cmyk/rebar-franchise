"use client";

import { useMemo, useState } from "react";
import { createOrder, issueOrder, cancelOrder, updateOrderStatus } from "@/actions/retail";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";
import { rub } from "@/lib/format-client";
import { cn } from "@/lib/utils";

type ProductOpt = {
  id: string;
  name: string;
  retailPrice: number;
  preorderPrice: number;
  code: string;
  qty: number;
};

type Line = {
  productId: string | null;
  name: string;
  qty: number;
  unitPrice: number;
};

export type OrderHistoryRow = {
  id: string;
  number: string;
  kind: string;
  status: string;
  totalAmount: number;
  prepaidAmount: number;
  comment: string | null;
  dueAt: string | null;
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
  lines: Array<{ name: string; qty: number }>;
};

/** принят — жёлтый, куплен — светло-фиолетовый, в пути — красный, прибыл — зелёный */
const PROCUREMENT_STATUSES = [
  { value: "accepted", label: "Принят", className: "bg-yellow-400/35 text-yellow-950 border-yellow-500/50" },
  { value: "purchased", label: "Куплен", className: "bg-violet-300/40 text-violet-950 border-violet-400/50" },
  { value: "in_transit", label: "В пути", className: "bg-red-500/20 text-red-800 border-red-500/40" },
  { value: "arrived", label: "Прибыл", className: "bg-emerald-500/20 text-emerald-900 border-emerald-500/40" },
] as const;

export function orderStatusMeta(status: string) {
  switch (status) {
    case "reserved":
      return { label: "Резерв", className: "bg-slate-500/15 text-slate-800 border-slate-500/30" };
    case "issued":
      return { label: "Выдан", className: "bg-emerald-600/15 text-emerald-900 border-emerald-600/30" };
    case "cancelled":
      return { label: "Отменён", className: "bg-stone-400/20 text-stone-700 border-stone-400/40" };
    case "accepted":
      return PROCUREMENT_STATUSES[0];
    case "purchased":
      return PROCUREMENT_STATUSES[1];
    case "in_transit":
      return PROCUREMENT_STATUSES[2];
    case "arrived":
      return PROCUREMENT_STATUSES[3];
    default:
      return { label: status, className: "bg-secondary text-secondary-foreground border-transparent" };
  }
}

export function OrderStatusBadge({ status }: { status: string }) {
  const meta = orderStatusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}

export function OrderCreateForm({ storeId, products }: { storeId: string; products: ProductOpt[] }) {
  const [mode, setMode] = useState<"stock_reserve" | "procurement">("procurement");
  const [productId, setProductId] = useState("");
  const [customName, setCustomName] = useState("");
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);

  const inStock = useMemo(() => products.filter((p) => p.qty > 0), [products]);
  const selected = products.find((p) => p.id === productId) ?? inStock[0];

  function addLine() {
    setError(null);
    if (mode === "stock_reserve") {
      const p = selected;
      if (!p) {
        setError("Нет товаров с остатком для резерва");
        return;
      }
      if (p.qty < qty) {
        setError(`Недостаточно на складе: ${p.name} (доступно ${p.qty})`);
        return;
      }
      const already = lines.filter((l) => l.productId === p.id).reduce((s, l) => s + l.qty, 0);
      if (already + qty > p.qty) {
        setError(`Нельзя зарезервировать больше остатка: ${p.name} (доступно ${p.qty})`);
        return;
      }
      setLines((prev) => [...prev, { productId: p.id, name: p.name, qty, unitPrice: p.retailPrice }]);
      return;
    }

    const name = customName.trim() || selected?.name;
    if (!name) {
      setError("Укажите название устройства");
      return;
    }
    const price = unitPrice || selected?.preorderPrice || selected?.retailPrice || 0;
    setLines((prev) => [
      ...prev,
      {
        productId: productId || null,
        name,
        qty,
        unitPrice: price,
      },
    ]);
  }

  return (
    <div className="space-y-3 border border-border bg-card p-4">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Новый заказ</h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(
            "px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em]",
            mode === "procurement" ? "bg-foreground text-background" : "border border-border",
          )}
          onClick={() => {
            setMode("procurement");
            setError(null);
            setLines([]);
          }}
        >
          Новое устройство
        </button>
        <button
          type="button"
          className={cn(
            "px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em]",
            mode === "stock_reserve" ? "bg-foreground text-background" : "border border-border",
          )}
          onClick={() => {
            setMode("stock_reserve");
            setError(null);
            setLines([]);
          }}
        >
          Резерв со склада
        </button>
      </div>

      {mode === "stock_reserve" ? (
        <p className="text-xs text-muted-foreground">
          Только позиции с остатком. При создании остаток резервируется.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Заказ телефона / устройства под клиента — склад не трогаем. Статусы ниже в истории.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        {mode === "stock_reserve" ? (
          <select
            className="h-9 border border-input bg-background px-3 text-sm sm:col-span-2"
            value={selected?.id ?? ""}
            onChange={(e) => setProductId(e.target.value)}
          >
            {!inStock.length ? <option value="">Нет товаров с остатком</option> : null}
            {inStock.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name} · остаток {p.qty}
              </option>
            ))}
          </select>
        ) : (
          <>
            <Input
              className="sm:col-span-2"
              placeholder="Название устройства"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
            <select
              className="h-9 border border-input bg-background px-3 text-sm sm:col-span-3"
              value={productId}
              onChange={(e) => {
                const id = e.target.value;
                setProductId(id);
                const p = products.find((x) => x.id === id);
                if (p) {
                  setCustomName(p.name);
                  setUnitPrice(p.preorderPrice || p.retailPrice);
                }
              }}
            >
              <option value="">Каталог (опционально)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
            <div className="sm:col-span-2">
              <Label>Цена</Label>
              <Input
                type="number"
                min={0}
                value={unitPrice || ""}
                onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
              />
            </div>
          </>
        )}
        <div>
          <Label>Кол-во</Label>
          <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} />
        </div>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addLine}>
        + Позиция
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <ul className="text-sm">
        {lines.map((l, i) => (
          <li key={`${l.productId ?? l.name}-${i}`} className="flex justify-between gap-2 border-b border-border py-1">
            <span>
              {l.name} × {l.qty}
            </span>
            <span className="flex items-center gap-2">
              <span className="font-mono">{rub(l.unitPrice * l.qty)}</span>
              <button
                type="button"
                className="font-mono text-[10px] text-muted-foreground"
                onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
              >
                ×
              </button>
            </span>
          </li>
        ))}
      </ul>

      <form action={createOrder} className="grid gap-2 sm:grid-cols-2">
        <input type="hidden" name="storeId" value={storeId} />
        <input type="hidden" name="kind" value={mode} />
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
        {mode === "procurement" ? (
          <div>
            <Label>Срок</Label>
            <Input name="dueAt" type="date" />
          </div>
        ) : (
          <div>
            <Label>Комментарий</Label>
            <Input name="comment" />
          </div>
        )}
        {mode === "procurement" ? (
          <div className="sm:col-span-2">
            <Label>Комментарий</Label>
            <Input name="comment" />
          </div>
        ) : null}
        <Button type="submit" disabled={!lines.length} className="sm:col-span-2">
          {mode === "stock_reserve" ? "Создать и зарезервировать" : "Создать заказ"}
        </Button>
      </form>
    </div>
  );
}

export function OrderHistory({ storeId, orders }: { storeId: string; orders: OrderHistoryRow[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter((o) => {
      const hay = [
        o.number,
        o.status,
        o.kind,
        o.customerName ?? "",
        o.customerPhone ?? "",
        o.comment ?? "",
        ...o.lines.map((l) => l.name),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [orders, q]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">История заказов</h2>
          <p className="mt-1 text-xs text-muted-foreground">Все заказы точки · статусы меняются здесь</p>
        </div>
        <Input
          className="max-w-sm"
          placeholder="Поиск: номер, клиент, товар, статус…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-[0.1em]">
        {PROCUREMENT_STATUSES.map((s) => (
          <span key={s.value} className={cn("rounded-sm border px-2 py-1", s.className)}>
            {s.label}
          </span>
        ))}
      </div>

      <ul className="space-y-3">
        {!filtered.length ? (
          <li className="border border-border bg-card p-4 text-sm text-muted-foreground">
            {orders.length ? "Ничего не найдено." : "Заказов пока нет — создайте выше."}
          </li>
        ) : null}
        {filtered.map((o) => (
          <li key={o.id} className="border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-sm">{o.number}</p>
                  <OrderStatusBadge status={o.status} />
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {o.kind === "procurement" ? "новое устройство" : "резерв склада"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {o.customerName ?? "Без клиента"}
                  {o.customerPhone ? ` · ${o.customerPhone}` : ""}
                  {" · "}
                  {new Date(o.createdAt).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {o.dueAt
                    ? ` · срок ${new Date(o.dueAt).toLocaleDateString("ru-RU")}`
                    : ""}
                </p>
                <p className="mt-1 text-sm">{o.lines.map((l) => `${l.name}×${l.qty}`).join(", ")}</p>
                {o.comment ? <p className="mt-1 text-xs text-muted-foreground">{o.comment}</p> : null}
              </div>
              <div className="text-right">
                <p className="font-mono">{rub(o.totalAmount)}</p>
                {o.prepaidAmount > 0 ? (
                  <p className="font-mono text-[10px] text-muted-foreground">предоплата {rub(o.prepaidAmount)}</p>
                ) : null}
                {o.status === "reserved" ? (
                  <div className="mt-2">
                    <IssueOrderButton storeId={storeId} orderId={o.id} />
                  </div>
                ) : null}
                {o.kind === "procurement" && !["cancelled", "issued"].includes(o.status) ? (
                  <ProcurementStatusButtons storeId={storeId} orderId={o.id} status={o.status} />
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
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

export function ProcurementStatusButtons({
  storeId,
  orderId,
  status,
}: {
  storeId: string;
  orderId: string;
  status: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap justify-end gap-1">
      {PROCUREMENT_STATUSES.map((s) => (
        <form key={s.value} action={updateOrderStatus}>
          <input type="hidden" name="storeId" value={storeId} />
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="status" value={s.value} />
          <button
            type="submit"
            disabled={status === s.value}
            className={cn(
              "border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em]",
              status === s.value ? s.className : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            {s.label}
          </button>
        </form>
      ))}
    </div>
  );
}
