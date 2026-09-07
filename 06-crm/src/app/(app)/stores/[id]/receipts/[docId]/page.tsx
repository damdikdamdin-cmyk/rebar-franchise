import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { dateTime, rub, shortDate } from "@/lib/format";
import { Badge } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { PrintActions } from "@/components/print/print-actions";
import { ExcelExportButton } from "@/components/excel-export-button";
import { postExistingStockDoc } from "@/actions/retail";

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string; docId: string }>;
}) {
  const { id: storeId, docId } = await params;
  const doc = await prisma.stockDocument.findUnique({
    where: { id: docId },
    include: {
      supplier: true,
      user: true,
      store: true,
      lines: { include: { product: true } },
    },
  });
  if (!doc || doc.storeId !== storeId || doc.type !== "receipt") notFound();

  const qtyTotal = doc.lines.reduce((s, l) => s + l.qty, 0);
  const purchaseTotal = doc.lines.reduce((s, l) => s + l.price * l.qty, 0);
  const retailTotal = doc.lines.reduce(
    (s, l) => s + (l.retailPrice || l.product.retailPrice) * l.qty,
    0,
  );
  const productIds = [...new Set(doc.lines.map((l) => l.productId))];

  const exportRows = doc.lines.map((l) => [
    l.product.code,
    l.product.name,
    l.serial ?? "",
    l.qty,
    l.price,
    l.price * l.qty,
    l.retailPrice || l.product.retailPrice,
    (l.retailPrice || l.product.retailPrice) - l.price,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/stores/${storeId}/receipts`}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
          >
            ← Поступления
          </Link>
          <h1 className="mt-2 font-serif text-3xl">Поступление {doc.store.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm">
              {doc.number} · {dateTime(doc.createdAt)}
            </span>
            <Badge tone={doc.postedAt ? "success" : "steel"}>
              {doc.postedAt ? (doc.paidAmount >= doc.totalAmount && doc.totalAmount > 0 ? "Оплачено" : "Проведён") : "Черновик"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExcelExportButton
            filename={`${doc.number}.csv`}
            headers={["Код", "Товар", "IMEI", "Кол-во", "Закуп", "Сумма закупа", "Розница", "Маржа шт."]}
            rows={exportRows}
          />
          <PrintActions
            label="Печать"
            actions={[
              { key: "invoice", label: "Приходная накладная", href: `/print/stock_receipt?doc=${doc.id}&store=${storeId}` },
              {
                key: "tags",
                label: "Ценники на все модели",
                href: `/print/price_big?store=${storeId}&products=${productIds.join(",")}`,
              },
              {
                key: "labels",
                label: "Этикетки 43×25",
                href: `/print/label_43x25?store=${storeId}&products=${productIds.join(",")}`,
              },
            ]}
          />
        </div>
      </div>

      <section className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Поставщик</p>
          <p className="text-sm">{doc.supplier?.name ?? "—"}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Склад</p>
          <p className="text-sm">{doc.store.name} · {doc.store.city}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Ответственный</p>
          <p className="text-sm">{doc.user?.name ?? "—"}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Вход. докум. №</p>
          <p className="text-sm">
            {doc.externalNumber ?? "—"}
            {doc.externalDate ? ` · ${shortDate(doc.externalDate)}` : ""}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Примечание</p>
          <p className="text-sm">{doc.comment ?? "—"}</p>
        </div>
      </section>

      <section className="overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr className="border-b border-border text-left">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Код</th>
              <th className="px-3 py-2">Товары</th>
              <th className="px-3 py-2">S/N</th>
              <th className="px-3 py-2">Кол-во</th>
              <th className="px-3 py-2">Закуп. цена</th>
              <th className="px-3 py-2">Сумма закупа</th>
              <th className="px-3 py-2">Розничная</th>
              <th className="px-3 py-2">Маржа</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => {
              const retail = l.retailPrice || l.product.retailPrice;
              return (
                <tr key={l.id} className="border-b border-border">
                  <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.product.code}</td>
                  <td className="px-3 py-2">{l.product.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.serial ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{l.qty}</td>
                  <td className="px-3 py-2 font-mono">{rub(l.price)}</td>
                  <td className="px-3 py-2 font-mono">{rub(l.price * l.qty)}</td>
                  <td className="px-3 py-2 font-mono">{rub(retail)}</td>
                  <td className="px-3 py-2 font-mono">{rub((retail - l.price) * l.qty)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex flex-wrap justify-between gap-2 border-t border-border px-4 py-3 font-mono text-sm">
          <span>
            Итого: {qtyTotal} шт.
          </span>
          <span>
            закуп {rub(purchaseTotal)} · розница {rub(retailTotal)} · прибыль {rub(retailTotal - purchaseTotal)}
          </span>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href={`/stores/${storeId}/receipts`} className="inline-flex h-9 items-center border border-border px-3 text-sm">
          Закрыть
        </Link>
        {!doc.postedAt ? (
          <form action={postExistingStockDoc}>
            <input type="hidden" name="storeId" value={storeId} />
            <input type="hidden" name="documentId" value={doc.id} />
            <Button type="submit">Провести</Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
