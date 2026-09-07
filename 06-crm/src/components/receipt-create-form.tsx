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
  name: string;
  purchasePrice: number;
  retailPrice: number;
  qty: number;
  serialTracked: boolean;
};

type Line = {
  productId: string | null;
  code: string;
  name: string;
  qty: number;
  price: number;
  retailPrice: number;
  warrantyDays: number;
  serial?: string;
  serialTracked?: boolean;
  isNew?: boolean;
};

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
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [retailPrice, setRetailPrice] = useState(0);
  const [warrantyDays, setWarrantyDays] = useState(365);
  const [serial, setSerial] = useState("");
  const [serialTracked, setSerialTracked] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    const q = modelName.trim().toLowerCase();
    if (!q) return catalog.slice(0, 8);
    return catalog
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [catalog, modelName]);

  function pickProduct(p: ProductOpt) {
    setProductId(p.id);
    setModelName(p.name);
    setCode(p.code);
    setPrice(p.purchasePrice);
    setRetailPrice(p.retailPrice);
    setSerialTracked(p.serialTracked);
    setWarrantyDays(365);
    setHint(`Из номенклатуры: ${p.name}`);
  }

  function onModelChange(value: string) {
    setModelName(value);
    const exact = catalog.find((p) => p.name.toLowerCase() === value.trim().toLowerCase());
    if (exact) {
      pickProduct(exact);
      return;
    }
    setProductId("");
    setHint(
      value.trim()
        ? "Новая модель — при сохранении поступления попадёт в номенклатуру"
        : null,
    );
  }

  function addLine() {
    const name = modelName.trim();
    if (!name || qty <= 0) {
      setHint("Введите название модели");
      return;
    }
    const matched =
      catalog.find((p) => p.id === productId && !p.id.startsWith("tmp-")) ??
      catalog.find((p) => p.name.toLowerCase() === name.toLowerCase() && !p.id.startsWith("tmp-"));
    const line: Line = {
      productId: matched?.id ?? null,
      code: code.trim() || matched?.code || "новый",
      name: matched?.name ?? name,
      qty: serialTracked || serial.trim() ? 1 : qty,
      price,
      retailPrice,
      warrantyDays: Math.max(0, warrantyDays || 365),
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
    setPrice(0);
    setRetailPrice(0);
    setWarrantyDays(365);
    setHint("Строка добавлена. Новые модели сохранятся в каталог при создании поступления.");
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
      const iName = idx(["name", "товар", "наименование", "товары", "модель"]);
      const iQty = idx(["qty", "кол-во", "количество", "кол"]);
      const iPurchase = idx(["purchase", "закуп", "закуп. цена", "себестоимость", "price"]);
      const iRetail = idx(["retail", "розница", "розничная"]);
      const iSerial = idx(["serial", "imei", "s/n", "sn"]);

      const byCode = new Map(catalog.map((p) => [p.code.toLowerCase(), p]));
      const byName = new Map(catalog.map((p) => [p.name.toLowerCase(), p]));
      const next: Line[] = [];
      let createdLocal = 0;
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
        next.push({
          productId: product?.id ?? null,
          code: rowCode || product?.code || "новый",
          name: rowName || product?.name || rowCode,
          qty: Math.max(1, Number(row[iQty] ?? 1) || 1),
          price: purchase,
          retailPrice: retail,
          warrantyDays: 365,
          serial: sn || undefined,
          serialTracked: Boolean(sn) || product?.serialTracked,
          isNew: !product,
        });
        if (!product) createdLocal++;
      }
      setLines((prev) => [...prev, ...next]);
      setImportMsg(
        `Загружено: ${next.length}${createdLocal ? ` · новых моделей (сохранятся в номенклатуру): ${createdLocal}` : ""}`,
      );
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
      <p className="text-xs text-muted-foreground">
        Модель можно ввести вручную — при создании поступления она сохранится в номенклатуру и подставится в следующий раз.
      </p>
      {importMsg ? <p className="text-xs text-muted-foreground">{importMsg}</p> : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <Label htmlFor="modelName">Модель / название</Label>
          <Input
            id="modelName"
            list={listId}
            value={modelName}
            onChange={(e) => onModelChange(e.target.value)}
            placeholder="Apple iPhone 16 Pro 256GB Black"
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
          <Label>Код (опц.)</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="авто" />
        </div>
        <div>
          <Label>Кол-во</Label>
          <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} />
        </div>
        <div>
          <Label>Закуп</Label>
          <Input type="number" value={price || ""} onChange={(e) => setPrice(Number(e.target.value) || 0)} />
        </div>
        <div>
          <Label>Розница</Label>
          <Input type="number" value={retailPrice || ""} onChange={(e) => setRetailPrice(Number(e.target.value) || 0)} />
        </div>
        <div>
          <Label>Гарантия, дн.</Label>
          <Input type="number" min={0} value={warrantyDays} onChange={(e) => setWarrantyDays(Number(e.target.value) || 0)} />
        </div>
        <div>
          <Label>IMEI / S/N</Label>
          <Input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="350070402858053" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={serialTracked} onChange={(e) => setSerialTracked(e.target.checked)} />
        Серийный товар (IMEI / S/N)
      </label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <Button type="button" variant="outline" size="sm" onClick={addLine}>
        + Добавить товар
      </Button>

      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr className="border-b border-border text-left">
              <th className="px-3 py-2">Код</th>
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
              <tr key={`${l.name}-${i}`} className="border-b border-border">
                <td className="px-3 py-2 font-mono text-xs">{l.code}</td>
                <td className="px-3 py-2">
                  {l.name}
                  {l.isNew ? (
                    <span className="ml-2 font-mono text-[10px] uppercase text-muted-foreground">новая</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{l.serial ?? "—"}</td>
                <td className="px-3 py-2 font-mono">{l.qty}</td>
                <td className="px-3 py-2 font-mono">{rub(l.price)}</td>
                <td className="px-3 py-2 font-mono">{rub(l.retailPrice)}</td>
                <td className="px-3 py-2 font-mono">{l.warrantyDays} дн.</td>
                <td className="px-3 py-2">
                  <button type="button" className="font-mono text-[10px]" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>
                    удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-xs text-muted-foreground">
        Итого: {lines.reduce((s, l) => s + l.qty, 0)} шт. · закуп {rub(totalPurchase)} · розница {rub(totalRetail)} · маржа{" "}
        {rub(totalRetail - totalPurchase)}
      </p>

      <form action={createStockDoc} className="grid gap-2 sm:grid-cols-2">
        <input type="hidden" name="storeId" value={storeId} />
        <input type="hidden" name="type" value="receipt" />
        <input type="hidden" name="payload" value={JSON.stringify(lines)} />
        <div>
          <Label>Поставщик</Label>
          <select name="supplierId" defaultValue="__none__" className="mt-1 flex h-9 w-full border border-input bg-background px-3 text-sm">
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
          <Input name="paidAmount" type="number" defaultValue={0} />
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
