"use client";

import { useMemo, useState } from "react";
import { createStockDoc } from "@/actions/retail";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";
import { rub } from "@/lib/format-client";
import { parseExcelCsv } from "@/lib/excel-csv";
import { cn } from "@/lib/utils";

type ProductOpt = {
  id: string;
  code: string;
  barcode?: string | null;
  name: string;
  purchasePrice: number;
  retailPrice: number;
  qty: number;
  serialTracked: boolean;
};

type Line = {
  productId: string | null;
  code: string;
  barcode: string;
  name: string;
  qty: number;
  price: number;
  retailPrice: number;
  warrantyDays: number;
  serial?: string;
  serialTracked?: boolean;
  isNew?: boolean;
};

function parseMoney(raw: string) {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".").trim();
  if (!cleaned) return "";
  const n = Number(cleaned);
  return Number.isFinite(n) ? String(Math.max(0, Math.trunc(n))) : "";
}

export function ReceiptCreateForm({
  storeId,
  products: initialProducts,
  suppliers = [],
}: {
  storeId: string;
  products: ProductOpt[];
  suppliers?: Array<{ id: string; name: string }>;
}) {
  const [catalog, setCatalog] = useState(initialProducts);
  const [productId, setProductId] = useState("");
  const [modelName, setModelName] = useState("");
  const [code, setCode] = useState("");
  const [barcode, setBarcode] = useState("");
  const [qtyText, setQtyText] = useState("1");
  const [priceText, setPriceText] = useState("");
  const [retailText, setRetailText] = useState("");
  const [warrantyText, setWarrantyText] = useState("365");
  const [serial, setSerial] = useState("");
  const [serialTracked, setSerialTracked] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const [triedAdd, setTriedAdd] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    const q = modelName.trim().toLowerCase();
    if (!q) return catalog.slice(0, 8);
    return catalog
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.barcode ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [catalog, modelName]);

  const nameInvalid = triedAdd && !modelName.trim();
  const purchaseInvalid = triedAdd && !priceText.trim();
  const retailInvalid = triedAdd && !retailText.trim();
  const serialInvalid = triedAdd && serialTracked && !serial.trim();

  function pickProduct(p: ProductOpt) {
    setProductId(p.id);
    setModelName(p.name);
    setCode(p.code);
    setBarcode(p.barcode ?? "");
    setPriceText(p.purchasePrice ? String(p.purchasePrice) : "");
    setRetailText(p.retailPrice ? String(p.retailPrice) : "");
    setSerialTracked(p.serialTracked);
    setWarrantyText("365");
  }

  function onModelChange(value: string) {
    setModelName(value);
    const exact = catalog.find((p) => p.name.toLowerCase() === value.trim().toLowerCase());
    if (exact) {
      pickProduct(exact);
      return;
    }
    setProductId("");
  }

  function addLine() {
    setTriedAdd(true);
    const name = modelName.trim();
    const price = Number(priceText) || 0;
    const retailPrice = Number(retailText) || 0;
    const warrantyDays = Number(warrantyText);
    const qty = Math.max(1, Number(qtyText) || 1);
    if (!name || !priceText.trim() || !retailText.trim()) return;
    if (serialTracked && !serial.trim()) return;

    const matched =
      catalog.find((p) => p.id === productId && !p.id.startsWith("tmp-")) ??
      catalog.find((p) => p.name.toLowerCase() === name.toLowerCase() && !p.id.startsWith("tmp-"));

    const line: Line = {
      productId: matched?.id ?? null,
      code: code.trim() || matched?.code || "новый",
      barcode: barcode.trim() || matched?.barcode || "",
      name: matched?.name ?? name,
      qty: serialTracked || serial.trim() ? 1 : qty,
      price,
      retailPrice,
      warrantyDays: Number.isFinite(warrantyDays) && warrantyDays >= 0 ? warrantyDays : 365,
      serial: serial.trim() || undefined,
      serialTracked: serialTracked || Boolean(serial.trim()),
      isNew: !matched,
    };
    setLines((prev) => [...prev, line]);
    if (!matched) {
      setCatalog((prev) => {
        if (prev.some((p) => p.name.toLowerCase() === name.toLowerCase())) return prev;
        return [
          {
            id: `tmp-${Date.now()}`,
            code: line.code === "новый" ? "" : line.code,
            barcode: line.barcode || null,
            name,
            purchasePrice: price,
            retailPrice,
            qty: 0,
            serialTracked: line.serialTracked ?? true,
          },
          ...prev,
        ];
      });
    }
    setSerial("");
    setModelName("");
    setProductId("");
    setCode("");
    setBarcode("");
    setPriceText("");
    setRetailText("");
    setQtyText("1");
    setWarrantyText("365");
    setTriedAdd(false);
  }

  function onImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const table = parseExcelCsv(text);
      if (table.length < 2) {
        setImportMsg("Файл пуст или без строк");
        return;
      }
      const header = table[0].map((h) => h.toLowerCase());
      const idx = (names: string[]) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
      const iCode = idx(["code", "код"]);
      const iBarcode = idx(["barcode", "штрихкод", "штрих-код", "ean"]);
      const iName = idx(["name", "товар", "наименование", "товары", "модель"]);
      const iQty = idx(["qty", "кол-во", "количество", "кол"]);
      const iPurchase = idx(["purchase", "закуп", "закуп. цена", "себестоимость", "price"]);
      const iRetail = idx(["retail", "розница", "розничная"]);
      const iSerial = idx(["serial", "imei", "s/n", "sn"]);
      const iWarranty = idx(["warranty", "гарантия", "гарантия дн", "гарантия, дн"]);

      const byCode = new Map(catalog.map((p) => [p.code.toLowerCase(), p]));
      const byName = new Map(catalog.map((p) => [p.name.toLowerCase(), p]));
      const next: Line[] = [];
      for (const row of table.slice(1)) {
        const rowCode = iCode >= 0 ? row[iCode]?.trim() : "";
        const rowName = iName >= 0 ? row[iName]?.trim() : "";
        if (!rowName && !rowCode) continue;
        const product =
          (rowCode && byCode.get(rowCode.toLowerCase())) ||
          (rowName && byName.get(rowName.toLowerCase())) ||
          null;
        const purchase = Number(String(row[iPurchase] ?? "").replace(/\s/g, "")) || product?.purchasePrice || 0;
        const retail = Number(String(row[iRetail] ?? "").replace(/\s/g, "")) || product?.retailPrice || 0;
        const sn = iSerial >= 0 ? row[iSerial]?.trim() : "";
        const w = iWarranty >= 0 ? Number(String(row[iWarranty] ?? "").replace(/\s/g, "")) : 365;
        next.push({
          productId: product?.id ?? null,
          code: rowCode || product?.code || "новый",
          barcode: (iBarcode >= 0 ? row[iBarcode]?.trim() : "") || product?.barcode || "",
          name: rowName || product?.name || rowCode,
          qty: Math.max(1, Number(row[iQty] ?? 1) || 1),
          price: purchase,
          retailPrice: retail,
          warrantyDays: Number.isFinite(w) && w >= 0 ? w : 365,
          serial: sn || undefined,
          serialTracked: Boolean(sn) || product?.serialTracked,
          isNew: !product,
        });
      }
      setLines((prev) => [...prev, ...next]);
      setImportMsg(`Загружено: ${next.length}`);
    };
    reader.readAsText(file);
  }

  const totalPurchase = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const totalRetail = lines.reduce((s, l) => s + l.retailPrice * l.qty, 0);
  const listId = "receipt-product-suggest";

  return (
    <div className="space-y-4 border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Новое поступление</h2>
        <label className="cursor-pointer border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em]">
          Загрузить Excel
          <input
            type="file"
            accept=".csv,.txt,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {importMsg ? <p className="text-xs text-muted-foreground">{importMsg}</p> : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <div className="sm:col-span-2 xl:col-span-2">
          <Label htmlFor="modelName" required invalid={nameInvalid}>
            Модель / название
          </Label>
          <Input
            id="modelName"
            list={listId}
            value={modelName}
            invalid={nameInvalid}
            onChange={(e) => onModelChange(e.target.value)}
            autoComplete="off"
          />
          <datalist id={listId}>
            {suggestions.map((p) => (
              <option key={p.id} value={p.name}>
                {p.code}
              </option>
            ))}
          </datalist>
          {suggestions.length && modelName.trim() && !productId ? (
            <ul className="mt-1 max-h-36 overflow-auto border border-border bg-background text-sm">
              {suggestions.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left hover:bg-accent"
                    onClick={() => pickProduct(p)}
                  >
                    <span className="font-mono text-[10px] text-muted-foreground">{p.code}</span> · {p.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div>
          <Label>Код</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div>
          <Label>Штрихкод</Label>
          <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="font-mono" />
        </div>
        <div>
          <Label>Кол-во</Label>
          <Input
            inputMode="numeric"
            value={qtyText}
            onChange={(e) => setQtyText(e.target.value.replace(/[^\d]/g, ""))}
          />
        </div>
        <div>
          <Label required invalid={purchaseInvalid}>
            Закуп
          </Label>
          <Input
            inputMode="numeric"
            value={priceText}
            invalid={purchaseInvalid}
            onChange={(e) => setPriceText(parseMoney(e.target.value))}
          />
        </div>
        <div>
          <Label required invalid={retailInvalid}>
            Розница
          </Label>
          <Input
            inputMode="numeric"
            value={retailText}
            invalid={retailInvalid}
            onChange={(e) => setRetailText(parseMoney(e.target.value))}
          />
        </div>
        <div>
          <Label>Гарантия, дн.</Label>
          <Input
            inputMode="numeric"
            value={warrantyText}
            onChange={(e) => setWarrantyText(e.target.value.replace(/[^\d]/g, ""))}
          />
        </div>
        <div>
          <Label required={serialTracked} invalid={serialInvalid}>
            IMEI / S/N
          </Label>
          <Input
            value={serial}
            invalid={serialInvalid}
            onChange={(e) => setSerial(e.target.value)}
            className="font-mono"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={serialTracked} onChange={(e) => setSerialTracked(e.target.checked)} />
        Серийный товар (IMEI / S/N)
      </label>
      <Button type="button" variant="outline" size="sm" onClick={addLine}>
        + Добавить товар
      </Button>

      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr className="border-b border-border text-left">
              <th className="px-3 py-2">Код</th>
              <th className="px-3 py-2">Штрихкод</th>
              <th className="px-3 py-2">Товар</th>
              <th className="px-3 py-2">S/N</th>
              <th className="px-3 py-2">Кол-во</th>
              <th className="px-3 py-2">Закуп</th>
              <th className="px-3 py-2">Розница</th>
              <th className="px-3 py-2">Гарантия</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={`${l.name}-${l.serial ?? i}-${i}`} className="border-b border-border">
                <td className="px-3 py-2 font-mono text-xs">{l.code}</td>
                <td className="px-3 py-2 font-mono text-xs">{l.barcode || "—"}</td>
                <td className="px-3 py-2">{l.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{l.serial ?? "—"}</td>
                <td className="px-3 py-2 font-mono">{l.qty}</td>
                <td className="px-3 py-2 font-mono">{rub(l.price)}</td>
                <td className="px-3 py-2 font-mono">{rub(l.retailPrice)}</td>
                <td className="px-3 py-2 font-mono">{l.warrantyDays} дн.</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="font-mono text-[10px]"
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-xs text-muted-foreground">
        Итого: {lines.reduce((s, l) => s + l.qty, 0)} шт. · закуп {rub(totalPurchase)} · розница {rub(totalRetail)} ·
        валовая прибыль {rub(totalRetail - totalPurchase)}
      </p>

      <form action={createStockDoc} className="grid gap-2 sm:grid-cols-2">
        <input type="hidden" name="storeId" value={storeId} />
        <input type="hidden" name="type" value="receipt" />
        <input type="hidden" name="payload" value={JSON.stringify(lines)} />
        <div>
          <Label>Поставщик</Label>
          <select
            name="supplierId"
            defaultValue="__none__"
            className="mt-1 flex h-9 w-full border border-input bg-background px-3 text-sm"
          >
            <option value="__none__">Не указан</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Вход. докум. №</Label>
          <Input name="externalNumber" />
        </div>
        <div>
          <Label>Дата вход. док.</Label>
          <Input name="externalDate" type="date" />
        </div>
        <div>
          <Label>Комментарий</Label>
          <Input name="comment" />
        </div>
        <div>
          <Label>Оплачено, ₽</Label>
          <Input name="paidAmount" inputMode="numeric" defaultValue="" placeholder="" />
        </div>
        <div className="flex items-end">
          <label className={cn("flex items-center gap-2 text-sm")}>
            <input type="checkbox" name="autoPost" value="1" defaultChecked />
            Сразу провести
          </label>
        </div>
        <Button type="submit" disabled={!lines.length} className="sm:col-span-2">
          Создать поступление
        </Button>
      </form>
    </div>
  );
}
