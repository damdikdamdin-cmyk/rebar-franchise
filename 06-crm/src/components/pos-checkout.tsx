"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { completeSale } from "@/actions/retail";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";
import { rub } from "@/lib/format-client";
import { useBarcodeScanner, BarcodeCameraButton } from "@/components/print/barcode-scanner";
import { PrintActions } from "@/components/print/print-actions";

type ProductRow = {
  id: string;
  code: string;
  barcode: string | null;
  name: string;
  retailPrice: number;
  serialTracked: boolean;
  qty: number;
  otherQty: number;
};

type SerialRow = { id: string; productId: string; serial: string; retailPrice?: number | null };
type ImeiAlias = { oldSerial: string; serialId: string; productId: string; currentSerial: string };

type CartLine = {
  productId: string;
  serialId?: string;
  name: string;
  qty: number;
  unitPrice: number;
  priceText: string;
  discountType: "none" | "amount" | "percent";
  discountValue: number;
  discountText: string;
  serial?: string;
  serialTracked: boolean;
};

type SearchHit = ProductRow & {
  matchedSerial?: string;
  matchedSerialId?: string;
  matchedViaOld?: string;
};

function calcLine(line: CartLine) {
  const gross = line.unitPrice * line.qty;
  if (line.discountType === "amount") return Math.max(0, gross - line.discountValue);
  if (line.discountType === "percent") return Math.max(0, Math.round(gross * (1 - line.discountValue / 100)));
  return gross;
}

function parseDiscountText(raw: string) {
  const cleaned = raw.replace(",", ".").trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function normSerial(s: string) {
  return s.replace(/\s+/g, "").toLowerCase();
}

export function PosCheckout({
  storeId,
  products,
  serials = [],
  imeiAliases = [],
  soldId,
  printKeys = [],
  salesLocked = false,
  inventoryDocId,
}: {
  storeId: string;
  products: ProductRow[];
  serials?: SerialRow[];
  imeiAliases?: ImeiAlias[];
  soldId?: string;
  printKeys?: string[];
  salesLocked?: boolean;
  inventoryDocId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [printReceipt, setPrintReceipt] = useState(true);
  const [printWarranty, setPrintWarranty] = useState(true);
  const [picker, setPicker] = useState<ProductRow | null>(null);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [cardText, setCardText] = useState("");
  const [creditText, setCreditText] = useState("");

  const preferredPrint = useMemo(() => {
    const keys = printKeys.length ? printKeys : ["receipt", "warranty"];
    return keys.filter((k) => k === "receipt" || k === "warranty");
  }, [printKeys]);

  const serialByNorm = useMemo(() => {
    const map = new Map<string, SerialRow>();
    for (const s of serials) map.set(normSerial(s.serial), s);
    return map;
  }, [serials]);

  const aliasByNorm = useMemo(() => {
    const map = new Map<string, ImeiAlias>();
    for (const a of imeiAliases) map.set(normSerial(a.oldSerial), a);
    return map;
  }, [imeiAliases]);

  const resolveSerial = useCallback(
    (raw: string): SerialRow | undefined => {
      const n = normSerial(raw);
      if (n.length < 4) return undefined;
      const direct = serialByNorm.get(n);
      if (direct) return direct;
      const alias = aliasByNorm.get(n);
      if (!alias) return undefined;
      return serials.find((s) => s.id === alias.serialId);
    },
    [serialByNorm, aliasByNorm, serials],
  );

  const cartSerials = useMemo(
    () => new Set(cart.map((l) => (l.serial ? normSerial(l.serial) : "")).filter(Boolean)),
    [cart],
  );

  const availableForPicker = useMemo(() => {
    if (!picker) return [];
    return serials.filter(
      (s) => s.productId === picker.id && !cartSerials.has(normSerial(s.serial)),
    );
  }, [picker, serials, cartSerials]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qNorm = normSerial(query);
    if (!q) return products.filter((p) => p.qty > 0 || p.otherQty > 0).slice(0, 40) as SearchHit[];

    const serialHit = qNorm.length >= 4 ? resolveSerial(qNorm) : undefined;
    const serialPartial =
      qNorm.length >= 4 ? serials.filter((s) => normSerial(s.serial).includes(qNorm)) : [];
    const aliasPartial =
      qNorm.length >= 4 ? imeiAliases.filter((a) => normSerial(a.oldSerial).includes(qNorm)) : [];

    const byId = new Map<string, SearchHit>();
    for (const p of products) {
      const nameHit =
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q);
      const snExact = serialHit?.productId === p.id ? serialHit : undefined;
      const snPart = serialPartial.find((s) => s.productId === p.id);
      const aliasHit = aliasPartial.find((a) => a.productId === p.id);
      if (nameHit || snExact || snPart || aliasHit) {
        byId.set(p.id, {
          ...p,
          matchedSerial: snExact?.serial ?? snPart?.serial ?? aliasHit?.currentSerial,
          matchedSerialId: snExact?.id ?? snPart?.id ?? aliasHit?.serialId,
          matchedViaOld: aliasHit && !snExact ? aliasHit.oldSerial : undefined,
        });
      }
    }
    return [...byId.values()].slice(0, 40);
  }, [products, query, resolveSerial, serials, imeiAliases]);

  const total = cart.reduce((s, l) => s + calcLine(l), 0);
  const cardAmount = Math.max(0, Math.trunc(Number(cardText.replace(/\D/g, "")) || 0));
  const creditAmount = Math.max(0, Math.trunc(Number(creditText.replace(/\D/g, "")) || 0));
  const cashAmount = Math.max(0, total - cardAmount - creditAmount);
  const payload = cart.map(({ discountText: _t, serialTracked: _s, serialId: _id, priceText: _p, ...line }) => line);

  function pushLine(p: ProductRow, serial?: string, serialId?: string, unitPrice?: number) {
    if (p.qty <= 0) {
      setScanMsg(`Нет остатка: ${p.name}`);
      return;
    }
    const sn = serial?.trim() || "";
    if (p.serialTracked && !sn) {
      setPicker(p);
      return;
    }
    if (sn && cartSerials.has(normSerial(sn))) {
      setScanMsg(`Уже в чеке: ${sn}`);
      return;
    }
    const price = unitPrice ?? p.retailPrice;
    setCart((prev) => {
      const next = [
        ...prev,
        {
          productId: p.id,
          serialId,
          name: p.name,
          qty: 1,
          unitPrice: price,
          priceText: String(price),
          discountType: "none" as const,
          discountValue: 0,
          discountText: "",
          serialTracked: p.serialTracked || Boolean(sn),
          serial: sn,
        },
      ];
      setEditing(next.length - 1);
      return next;
    });
    setPicker(null);
    setScanMsg(sn ? `${p.name} · ${sn}` : p.name);
  }

  function onProductClick(p: SearchHit) {
    if (p.matchedSerial) {
      pushLine(p, p.matchedSerial, p.matchedSerialId);
      return;
    }
    if (p.serialTracked) {
      setPicker(p);
      return;
    }
    pushLine(p);
  }

  const onScan = useCallback(
    (code: string) => {
      const raw = code.trim();
      const sn = resolveSerial(raw);
      if (sn) {
        const product = products.find((p) => p.id === sn.productId);
        if (product) {
          pushLine(product, sn.serial, sn.id, sn.retailPrice ?? undefined);
          setQuery("");
          return;
        }
      }
      const hit =
        products.find((p) => p.barcode === raw) ||
        products.find((p) => p.code === raw) ||
        products.find((p) => p.barcode?.endsWith(raw) || p.code.endsWith(raw));
      if (hit) {
        onProductClick(hit);
        setQuery("");
      } else {
        setQuery(raw);
        setScanMsg(`Не найден: ${raw}`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, resolveSerial, cartSerials],
  );

  useBarcodeScanner(onScan, !soldId && !salesLocked);

  const missingSerial = cart.some((l) => l.serialTracked && !(l.serial ?? "").trim());
  const canSubmit = cart.length > 0 && !missingSerial && !salesLocked;

  return (
    <div className="space-y-4">
      {salesLocked ? (
        <div className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Продажи этой точки приостановлены — идёт инвентаризация.{" "}
          <Link href={`/stores/${storeId}/inventories`} className="underline">
            К инвентаризации
          </Link>
          <span className="ml-2 font-mono text-[10px] text-amber-800/80">· другие точки работают как обычно</span>
        </div>
      ) : null}
      {picker ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto border border-border bg-card p-4 shadow-lg">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-serif text-xl">{picker.name}</h3>
                <p className="font-mono text-xs text-muted-foreground">Выберите IMEI / S/N со склада</p>
              </div>
              <button type="button" className="font-mono text-[10px] uppercase" onClick={() => setPicker(null)}>
                закрыть
              </button>
            </div>
            {!availableForPicker.length ? (
              <p className="text-sm text-muted-foreground">Нет свободных IMEI на складе этой точки</p>
            ) : (
              <ul className="divide-y divide-border border border-border">
                {availableForPicker.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-accent"
                      onClick={() => pushLine(picker, s.serial, s.id, s.retailPrice ?? undefined)}
                    >
                      <span className="font-mono text-sm">{s.serial}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {rub(s.retailPrice ?? picker.retailPrice)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {soldId ? (
        <div className="space-y-3 border border-border bg-card px-4 py-4">
          <p className="text-sm font-medium">Чек оформлен · остаток списан</p>
          <div className="flex flex-wrap gap-2">
            {preferredPrint.includes("receipt") ? (
              <a
                href={`/print/receipt?sale=${soldId}&store=${storeId}&auto=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex border border-border bg-foreground px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-background"
              >
                Товарный чек
              </a>
            ) : null}
            {preferredPrint.includes("warranty") ? (
              <a
                href={`/print/warranty?sale=${soldId}&store=${storeId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex border border-border bg-foreground px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-background"
              >
                Гарантийный талон
              </a>
            ) : null}
            <Link
              href={`/stores/${storeId}/sales/${soldId}`}
              className="inline-flex border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em]"
            >
              История чека
            </Link>
            <Link
              href={`/stores/${storeId}/sales`}
              className="inline-flex border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em]"
            >
              Все чеки
            </Link>
            <PrintActions
              label="Все документы"
              actions={[
                { key: "receipt", label: "Товарный чек", href: `/print/receipt?sale=${soldId}&store=${storeId}&auto=1` },
                { key: "warranty", label: "Гарантийный талон", href: `/print/warranty?sale=${soldId}&store=${storeId}` },
              ]}
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border p-3">
            <Input
              data-barcode-input="1"
              placeholder="Поиск, код, штрихкод или IMEI…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  e.preventDefault();
                  onScan(query.trim());
                }
              }}
            />
            <BarcodeCameraButton onScan={onScan} />
          </div>
          {scanMsg ? (
            <p className="border-b border-border px-3 py-1.5 font-mono text-[10px] text-muted-foreground">{scanMsg}</p>
          ) : null}
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
                    key={`${p.id}-${p.matchedSerial ?? ""}`}
                    className={`border-b border-border ${p.qty > 0 ? "cursor-pointer hover:bg-accent" : "opacity-50"}`}
                    onClick={() => p.qty > 0 && onProductClick(p)}
                  >
                    <td className="px-3 py-2">
                      <div>{p.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        Код: {p.code}
                        {p.serialTracked ? " · S/N" : ""}
                        {p.matchedSerial ? ` · ${p.matchedSerial}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono">{p.qty}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{p.otherQty}</td>
                    <td className="px-3 py-2 font-mono">{rub(p.retailPrice)}</td>
                  </tr>
                ))}
                {!filtered.length ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-sm text-muted-foreground">
                      Ничего не найдено
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border border-border bg-card p-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Чек</h2>
          {!cart.length ? (
            <p className="mt-6 text-sm text-muted-foreground">Выберите товар слева</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {cart.map((line, index) => (
                <li key={`${line.productId}-${line.serial ?? index}-${index}`} className="border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{line.name}</p>
                      {line.serial ? (
                        <p className="mt-0.5 font-mono text-xs">IMEI {line.serial}</p>
                      ) : line.serialTracked ? (
                        <p className="mt-0.5 font-mono text-[10px] text-red-600">обязательно · IMEI</p>
                      ) : null}
                      <p className="mt-1 font-mono text-xs">
                        {rub(line.unitPrice)} × {line.qty} = {rub(calcLine(line))}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <button
                        type="button"
                        className="font-mono text-[10px] uppercase underline"
                        onClick={() => setEditing(editing === index ? null : index)}
                      >
                        Редактировать
                      </button>
                      <Link
                        href={`/catalog/products/${line.productId}`}
                        className="font-mono text-[10px] uppercase underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Номенклатура
                      </Link>
                      {line.serialId ? (
                        <Link
                          href={`/stores/${storeId}/devices/${line.serialId}`}
                          className="font-mono text-[10px] uppercase underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Устройство
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className="font-mono text-[10px] text-muted-foreground"
                        onClick={() => {
                          setCart((prev) => prev.filter((_, i) => i !== index));
                          setEditing(null);
                        }}
                      >
                        удалить
                      </button>
                    </div>
                  </div>
                  {editing === index ? (
                    <div className="mt-3 grid gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Цена</Label>
                          <Input
                            inputMode="numeric"
                            value={line.priceText}
                            onChange={(e) => {
                              const priceText = e.target.value.replace(/[^\d]/g, "");
                              setCart((prev) =>
                                prev.map((l, i) =>
                                  i === index
                                    ? {
                                        ...l,
                                        priceText,
                                        unitPrice: priceText ? Number(priceText) : 0,
                                      }
                                    : l,
                                ),
                              );
                            }}
                          />
                        </div>
                        <div>
                          <Label>Кол-во</Label>
                          <Input
                            inputMode="numeric"
                            value={String(line.qty)}
                            disabled={line.serialTracked}
                            onChange={(e) =>
                              setCart((prev) =>
                                prev.map((l, i) =>
                                  i === index
                                    ? { ...l, qty: Math.max(1, Number(e.target.value.replace(/[^\d]/g, "")) || 1) }
                                    : l,
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
                                  prev.map((l, i) =>
                                    i === index
                                      ? {
                                          ...l,
                                          discountType: t,
                                          discountValue: t === "none" ? 0 : l.discountValue,
                                          discountText: t === "none" ? "" : l.discountText,
                                        }
                                      : l,
                                  ),
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
                            inputMode="decimal"
                            value={line.discountText}
                            onChange={(e) => {
                              const discountText = e.target.value.replace(/[^\d.,]/g, "");
                              setCart((prev) =>
                                prev.map((l, i) =>
                                  i === index
                                    ? {
                                        ...l,
                                        discountText,
                                        discountValue: parseDiscountText(discountText),
                                      }
                                    : l,
                                ),
                              );
                            }}
                          />
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <form
            action={completeSale}
            className="mt-4 space-y-3 border-t border-border pt-4"
            onSubmit={(e) => {
              setTriedSubmit(true);
              if (!canSubmit) e.preventDefault();
            }}
          >
            <input type="hidden" name="storeId" value={storeId} />
            <input type="hidden" name="payload" value={JSON.stringify(payload)} />
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="customerName">Клиент</Label>
                <Input id="customerName" name="customerName" />
              </div>
              <div>
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  name="phone"
                  inputMode="numeric"
                  autoComplete="tel"
                  onChange={(e) => {
                    e.target.value = e.target.value.replace(/\D/g, "");
                  }}
                />
              </div>
              <div>
                <Label htmlFor="cardAmount">Оплата по карте, ₽</Label>
                <Input
                  id="cardAmount"
                  name="cardAmount"
                  inputMode="numeric"
                  value={cardText}
                  onChange={(e) => setCardText(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div>
                <Label htmlFor="creditAmount">Lendo, ₽</Label>
                <Input
                  id="creditAmount"
                  name="creditAmount"
                  inputMode="numeric"
                  value={creditText}
                  onChange={(e) => setCreditText(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="sm:col-span-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Наличные · {rub(cashAmount)}
                  {cardAmount || creditAmount
                    ? ` · карта ${rub(cardAmount)} · Lendo ${rub(creditAmount)}`
                    : ""}
                </p>
              </div>
              <div>
                <Label htmlFor="note">Комментарий</Label>
                <Input id="note" name="note" />
              </div>
            </div>
            <div className="space-y-2 border border-border p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Печать после оформления</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="printReceipt"
                  value="1"
                  checked={printReceipt}
                  onChange={(e) => setPrintReceipt(e.target.checked)}
                />
                Товарный чек
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="printWarranty"
                  value="1"
                  checked={printWarranty}
                  onChange={(e) => setPrintWarranty(e.target.checked)}
                />
                Гарантийный талон
              </label>
            </div>
            <Button type="submit" className="w-full" disabled={!canSubmit}>
              Оформить · {rub(total)}
            </Button>
            {triedSubmit && missingSerial ? (
              <p className="text-xs text-red-600">Укажите IMEI для серийных позиций</p>
            ) : null}
          </form>
        </section>
      </div>
    </div>
  );
}
