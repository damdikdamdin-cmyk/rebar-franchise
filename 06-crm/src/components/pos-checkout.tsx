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

type SerialRow = { id: string; productId: string; serial: string };
type ImeiAlias = { oldSerial: string; serialId: string; productId: string; currentSerial: string };

type CartLine = {
  productId: string;
  serialId?: string;
  name: string;
  qty: number;
  unitPrice: number;
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
}: {
  storeId: string;
  products: ProductRow[];
  serials?: SerialRow[];
  imeiAliases?: ImeiAlias[];
  soldId?: string;
  printKeys?: string[];
}) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [printReceipt, setPrintReceipt] = useState(true);
  const [printWarranty, setPrintWarranty] = useState(true);

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
  const payload = cart.map(({ discountText: _t, serialTracked: _s, serialId: _id, ...line }) => line);

  function addProduct(p: ProductRow, serial?: string, serialId?: string) {
    if (p.qty <= 0) {
      setScanMsg(`Нет остатка: ${p.name}`);
      return;
    }
    const sn = serial?.trim() || "";
    const resolved = sn ? resolveSerial(sn) : undefined;
    const currentSn = resolved?.serial ?? sn;
    if (currentSn && cart.some((l) => l.serial && normSerial(l.serial) === normSerial(currentSn))) {
      setScanMsg(`Уже в чеке: ${currentSn}`);
      return;
    }
    setCart((prev) => {
      const next = [
        ...prev,
        {
          productId: p.id,
          serialId: serialId ?? resolved?.id,
          name: p.name,
          qty: 1,
          unitPrice: p.retailPrice,
          discountType: "none" as const,
          discountValue: 0,
          discountText: "",
          serialTracked: p.serialTracked || Boolean(currentSn),
          serial: currentSn,
        },
      ];
      setEditing(next.length - 1);
      return next;
    });
  }

  const onScan = useCallback(
    (code: string) => {
      const raw = code.trim();
      const sn = resolveSerial(raw);
      if (sn) {
        const product = products.find((p) => p.id === sn.productId);
        if (product) {
          const viaOld = aliasByNorm.get(normSerial(raw));
          addProduct(product, sn.serial, sn.id);
          setScanMsg(
            viaOld && normSerial(viaOld.oldSerial) === normSerial(raw)
              ? `Добавлен по старому IMEI ${viaOld.oldSerial} → ${sn.serial}`
              : `Добавлен по IMEI: ${product.name} · ${sn.serial}`,
          );
          setQuery("");
          return;
        }
      }
      const hit =
        products.find((p) => p.barcode === raw) ||
        products.find((p) => p.code === raw) ||
        products.find((p) => p.barcode?.endsWith(raw) || p.code.endsWith(raw));
      if (hit) {
        addProduct(hit);
        setScanMsg(`Добавлен: ${hit.name}`);
        setQuery("");
      } else {
        setQuery(raw);
        setScanMsg(`Не найден: ${raw}`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- addProduct closes over cart
    [products, resolveSerial, aliasByNorm, cart],
  );

  useBarcodeScanner(onScan, !soldId);

  const canSubmit =
    cart.length > 0 &&
    cart.every((l) => !l.serialTracked || (l.serial ?? "").trim().length > 0);

  return (
    <div className="space-y-4">
      {soldId ? (
        <div className="space-y-3 border border-border bg-card px-4 py-4">
          <p className="text-sm font-medium">Чек оформлен · остаток списан</p>
          <p className="text-xs text-muted-foreground">
            Нажмите кнопку печати вручную — авто-всплывающие окна браузер блокирует.
          </p>
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
              placeholder="Поиск, код, штрихкод или IMEI / старый IMEI…"
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
                    onClick={() => addProduct(p, p.matchedSerial, p.matchedSerialId)}
                  >
                    <td className="px-3 py-2">
                      <div>{p.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        Код: {p.code}
                        {p.barcode ? ` · ${p.barcode}` : ""}
                        {p.serialTracked ? " · S/N" : ""}
                        {p.matchedSerial ? ` · IMEI ${p.matchedSerial}` : ""}
                        {p.matchedViaOld ? ` · был ${p.matchedViaOld}` : ""}
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
                      Ничего не найдено. Проверьте IMEI в поступлениях / устройствах или название модели.
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
            <p className="mt-6 text-sm text-muted-foreground">Выберите товар слева или введите код.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {cart.map((line, index) => (
                <li key={`${line.productId}-${index}`} className="border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" className="text-left text-sm font-medium" onClick={() => setEditing(index)}>
                      {line.name}
                    </button>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {line.serialId ? (
                        <Link
                          href={`/stores/${storeId}/devices/${line.serialId}`}
                          className="font-mono text-[10px] uppercase underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Редактировать
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className="font-mono text-[10px] text-muted-foreground"
                        onClick={() => setCart((prev) => prev.filter((_, i) => i !== index))}
                      >
                        удалить
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 font-mono text-xs">
                    {rub(line.unitPrice)} × {line.qty} = {rub(calcLine(line))}
                    {line.serial ? ` · IMEI ${line.serial}` : ""}
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
                            placeholder="0"
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
                      {line.serialTracked ? (
                        <div>
                          <Label>IMEI / S/N</Label>
                          <Input
                            placeholder="356938035643809"
                            value={line.serial ?? ""}
                            onChange={(e) =>
                              setCart((prev) =>
                                prev.map((l, i) => (i === index ? { ...l, serial: e.target.value } : l)),
                              )
                            }
                          />
                          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                            Смена IMEI в карточке устройства — с записью в историю
                          </p>
                          {line.serialId ? (
                            <Link
                              href={`/stores/${storeId}/devices/${line.serialId}`}
                              className="mt-2 inline-block font-mono text-[10px] uppercase underline"
                            >
                              Карточка: гарантия, справки, IMEI
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <form action={completeSale} className="mt-4 space-y-3 border-t border-border pt-4">
            <input type="hidden" name="storeId" value={storeId} />
            <input type="hidden" name="payload" value={JSON.stringify(payload)} />
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
            {!canSubmit && cart.length ? (
              <p className="text-xs text-muted-foreground">Укажите IMEI / S/N для серийных позиций.</p>
            ) : null}
          </form>
        </section>
      </div>
    </div>
  );
}
