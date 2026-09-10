import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ReceiptCreateForm } from "@/components/receipt-create-form";
import { ExcelExportButton } from "@/components/excel-export-button";
import { Badge } from "@/components/ui/fields";
import { dateTime, rub } from "@/lib/format";
import { postExistingStockDoc } from "@/actions/retail";
import { Button } from "@/components/ui/button";
import { PrintActions } from "@/components/print/print-actions";
import { DeletedMark } from "@/components/deleted-mark";

export default async function ReceiptsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; deleted?: string; error?: string }>;
}) {
  const { id } = await params;
  const { q, deleted, error } = await searchParams;
  const needle = (q ?? "").trim().toLowerCase();
  const showDeleted = deleted === "1";

  const productsRaw = await prisma.product.findMany({
    where: { active: true, deletedAt: null },
    include: { balances: { where: { storeId: id } } },
    orderBy: { name: "asc" },
  });
  const products = productsRaw.map((p) => ({
    id: p.id,
    code: p.code,
    barcode: p.barcode,
    name: p.name,
    purchasePrice: p.purchasePrice,
    retailPrice: p.retailPrice,
    qty: p.balances[0]?.qty ?? 0,
    serialTracked: p.serialTracked,
  }));

  const [suppliers, docs] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.stockDocument.findMany({
      where: {
        storeId: id,
        type: "receipt",
        ...(showDeleted ? {} : { deletedAt: null }),
      },
      include: { supplier: true, user: true, deletedBy: true, lines: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const filtered = needle
    ? docs.filter((d) => {
        const hay = [
          d.number,
          d.comment ?? "",
          d.externalNumber ?? "",
          d.supplier?.name ?? "",
          ...d.lines.map((l) => `${l.product.name} ${l.serial ?? ""}`),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      })
    : docs;

  const total = filtered.reduce((s, d) => s + d.totalAmount, 0);
  const exportRows = filtered.map((d) => [
    d.number,
    dateTime(d.createdAt),
    d.user?.name ?? "",
    d.supplier?.name ?? "",
    d.totalAmount,
    d.paidAmount,
    d.postedAt ? "проведён" : "черновик",
    d.comment ?? "",
    d.externalNumber ?? "",
  ]);

  return (
    <div className="space-y-8">
      {error === "dup_imei" ? (
        <p className="text-sm text-destructive">В документе есть дублирующиеся IMEI — уберите повтор и создайте снова.</p>
      ) : null}
      <ReceiptCreateForm storeId={id} products={products} suppliers={suppliers} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">История поступлений</h2>
            <p className="mt-1 text-xs text-muted-foreground">Откройте документ — позиции, цены, печать накладной и ценников</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={showDeleted ? `/stores/${id}/receipts` : `/stores/${id}/receipts?deleted=1`}
              className="h-9 border border-border px-3 font-mono text-[10px] uppercase leading-9"
            >
              {showDeleted ? "Скрыть удалённые" : "Показать удалённые"}
            </Link>
            <form className="flex gap-2">
              <input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Поиск…"
                className="h-9 w-56 border border-input bg-background px-3 text-sm"
              />
              {showDeleted ? <input type="hidden" name="deleted" value="1" /> : null}
              <button type="submit" className="h-9 border border-border px-3 font-mono text-[10px] uppercase">
                Найти
              </button>
            </form>
            <ExcelExportButton
              filename={`receipts-${id}.csv`}
              headers={["Документ", "Дата", "Ответственный", "Поставщик", "Сумма", "Оплачено", "Статус", "Комментарий", "Вход.№"]}
              rows={exportRows}
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-border bg-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3">Документ</th>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Ответственный</th>
                <th className="px-4 py-3">Поставщик</th>
                <th className="px-4 py-3">Сумма закупа</th>
                <th className="px-4 py-3">Оплачено</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Комментарий</th>
                <th className="px-4 py-3">Действия</th>
              </tr>
            </thead>
            <tbody>
              {!filtered.length ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-muted-foreground">
                    Поступлений нет
                  </td>
                </tr>
              ) : null}
              {filtered.map((d) => {
                const retailSum = d.lines.reduce((s, l) => s + (l.retailPrice || l.product.retailPrice) * l.qty, 0);
                return (
                  <tr
                    key={d.id}
                    className={`border-b border-border last:border-0 ${d.deletedAt ? "bg-red-50/50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/stores/${id}/receipts/${d.id}`} className="font-mono underline">
                        {d.number}
                      </Link>
                      <DeletedMark at={d.deletedAt} who={d.deletedBy?.name} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{dateTime(d.createdAt)}</td>
                    <td className="px-4 py-3">{d.user?.name ?? "—"}</td>
                    <td className="px-4 py-3">{d.supplier?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-mono">
                      {rub(d.totalAmount)}
                      <div className="text-[10px] text-muted-foreground">розн. {rub(retailSum)}</div>
                    </td>
                    <td className="px-4 py-3 font-mono">{rub(d.paidAmount)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={d.postedAt ? "success" : "steel"}>{d.postedAt ? "проведён" : "черновик"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{d.comment ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {!d.postedAt && !d.deletedAt ? (
                          <form action={postExistingStockDoc}>
                            <input type="hidden" name="storeId" value={id} />
                            <input type="hidden" name="documentId" value={d.id} />
                            <Button type="submit" size="sm" variant="secondary">
                              Провести
                            </Button>
                          </form>
                        ) : null}
                        {!d.deletedAt ? (
                          <PrintActions
                            actions={[
                              { key: "doc", label: "Приходная накладная", href: `/print/stock_receipt?doc=${d.id}&store=${id}` },
                              {
                                key: "tags",
                                label: "Ценники",
                                href: `/print/price_big?store=${id}&products=${d.lines.map((l) => l.productId).join(",")}`,
                              },
                            ]}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Всего документов — {filtered.length}, на сумму {rub(total)}
        </p>
      </section>
    </div>
  );
}
