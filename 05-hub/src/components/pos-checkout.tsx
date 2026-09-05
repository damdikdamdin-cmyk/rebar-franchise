"use client";

import { useMemo, useState } from "react";
import { completeSale } from "@/actions/retail";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";
import { rub } from "@/lib/format-client";

type ProductRow = {
  id: string;
  code: string;
  name: string;
  retailPrice: number;
  serialTracked: boolean;
  qty: number;
  otherQty: number;
};

type CartLine = {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  discountType: "none" | "amount" | "percent";
  discountValue: number;
  serial?: string;
};

function calcLine(line: CartLine) {
  const gross = line.unitPrice * line.qty;
  if (line.discountType === "amount") return Math.max(0, gross - line.discountValue);
  if (line.discountType === "percent") return Math.max(0, Math.round(gross * (1 - line.discountValue / 100)));
  return gross;
}

export function PosCheckout({
  storeId,
  products,
  soldId,
}: {
  storeId: string;
  products: ProductRow[];
  soldId?: string;
}) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [editing, setEditing] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.filter((p) => p.qty > 0 || p.otherQty > 0).slice(0, 40);
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.code.includes(q))
      .slice(0, 40);
  }, [products, query]);

  const total = cart.reduce((s, l) => s + calcLine(l), 0);

  function addProduct(p: ProductRow) {
    setCart((prev) => {
      const next = [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          qty: 1,
          unitPrice: p.retailPrice,
          discountType: "none" as const,
          discountValue: 0,
        },
      ];
      setEditing(next.length - 1);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {soldId ? (
        <p className="border border-border bg-card px-3 py-2 text-sm">Чек оформлен</p>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="border border-border bg-card">
          <div className="border-b border-border p-3">
            <Input placeholder="Поиск товара или кода…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-2">Товар</th>
                  <th className="px-3 py-2">Склад</th>
                  <th className="px-3 py-2">Другие</th>
                  <th className="px-3 py-2">Цена</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer border-b border-border hover:bg-accent"
                    onClick={() => addProduct(p)}
                  >
                    <td className="px-3 py-2">
                      <div>{p.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">Код: {p.code}</div>
                    </td>
                    <td className="px-3 py-2 font-mono">{p.qty}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{p.otherQty}</td>
                    <td className="px-3 py-2 font-mono">{rub(p.retailPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border border-border bg-card p-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Чек</h2>
          {!cart.length ? (
            <p className="mt-6 text-sm text-muted-foreground">Выберите товар слева или введите код.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {cart.map((line, index) => (
                <li key={`${line.productId}-${index}`} className="border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" className="text-left text-sm font-medium" onClick={() => setEditing(index)}>
                      {line.name}
                    </button>
                    <button
                      type="button"
                      className="font-mono text-[10px] text-muted-foreground"
                      onClick={() => setCart((prev) => prev.filter((_, i) => i !== index))}
                    >
                      удалить
                    </button>
                  </div>
                  <p className="mt-1 font-mono text-xs">
                    {rub(line.unitPrice)} × {line.qty} = {rub(calcLine(line))}
                  </p>
                  {editing === index ? (
                    <div className="mt-3 grid gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Цена</Label>
                          <Input
                            type="number"
                            value={line.unitPrice}
                            onChange={(e) =>
                              setCart((prev) =>
                                prev.map((l, i) =>
                                  i === index ? { ...l, unitPrice: Number(e.target.value) || 0 } : l,
                                ),
                              )
                            }
                          />
                        </div>
                        <div>
                          <Label>Кол-во</Label>
                          <Input
                            type="number"
                            min={1}
                            value={line.qty}
                            onChange={(e) =>
                              setCart((prev) =>
                                prev.map((l, i) =>
                                  i === index ? { ...l, qty: Math.max(1, Number(e.target.value) || 1) } : l,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Скидка</Label>
                        <div className="mt-1 flex gap-1">
                          {(["none", "amount", "percent"] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              className={`px-2 py-1 font-mono text-[10px] uppercase ${
                                line.discountType === t ? "bg-foreground text-background" : "border border-border"
                              }`}
                              onClick={() =>
                                setCart((prev) =>
                                  prev.map((l, i) => (i === index ? { ...l, discountType: t } : l)),
                                )
                              }
                            >
                              {t === "none" ? "нет" : t === "amount" ? "₽" : "%"}
                            </button>
                          ))}
                        </div>
                        {line.discountType !== "none" ? (
                          <Input
                            className="mt-2"
                            type="number"
                            value={line.discountValue}
                            onChange={(e) =>
                              setCart((prev) =>
                                prev.map((l, i) =>
                                  i === index ? { ...l, discountValue: Number(e.target.value) || 0 } : l,
                                ),
                              )
                            }
                          />
                        ) : null}
                      </div>
                      <div>
                        <Label>S/N</Label>
                        <Input
                          value={line.serial ?? ""}
                          onChange={(e) =>
                            setCart((prev) =>
                              prev.map((l, i) => (i === index ? { ...l, serial: e.target.value } : l)),
                            )
                          }
                        />
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <form action={completeSale} className="mt-4 space-y-3 border-t border-border pt-4">
            <input type="hidden" name="storeId" value={storeId} />
            <input type="hidden" name="payload" value={JSON.stringify(cart)} />
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="customerName">Клиент</Label>
                <Input id="customerName" name="customerName" />
              </div>
              <div>
                <Label htmlFor="phone">Телефон</Label>
                <Input id="phone" name="phone" />
              </div>
              <div>
                <Label htmlFor="creditAmount">Lendo, ₽</Label>
                <Input id="creditAmount" name="creditAmount" type="number" defaultValue={0} />
              </div>
              <div>
                <Label htmlFor="note">Комментарий</Label>
                <Input id="note" name="note" />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={!cart.length}>
              Оформить · {rub(total)}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
