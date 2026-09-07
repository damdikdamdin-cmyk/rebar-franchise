import { dateTime, rub } from "@/lib/format";
import { Badge } from "@/components/ui/fields";

import { PrintActions } from "@/components/print/print-actions";

export function DocTable({
  docs,
  total,
  storeId,
  printKey = "stock_receipt",
}: {
  docs: Array<{
    id: string;
    number: string;
    createdAt: Date;
    postedAt: Date | null;
    totalAmount: number;
    paidAmount: number;
    comment: string | null;
    supplier?: { name: string } | null;
    user?: { name: string } | null;
  }>;
  total: number;
  storeId?: string;
  printKey?: string;
}) {
  return (
    <div>
      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3">Документ</th>
              <th className="px-4 py-3">Дата</th>
              <th className="px-4 py-3">Поставщик</th>
              <th className="px-4 py-3">Сумма</th>
              <th className="px-4 py-3">Оплачено</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Комментарий</th>
              <th className="px-4 py-3">Печать</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-mono">{d.number}</td>
                <td className="px-4 py-3 font-mono text-xs">{dateTime(d.createdAt)}</td>
                <td className="px-4 py-3">{d.supplier?.name ?? "—"}</td>
                <td className="px-4 py-3 font-mono">{rub(d.totalAmount)}</td>
                <td className="px-4 py-3 font-mono">{rub(d.paidAmount)}</td>
                <td className="px-4 py-3">
                  <Badge tone={d.postedAt ? "open" : "steel"}>{d.postedAt ? "проведён" : "черновик"}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{d.comment ?? "—"}</td>
                <td className="px-4 py-3">
                  {storeId ? (
                    <PrintActions
                      actions={[
                        { key: "doc", label: "Накладная", href: `/print/${printKey}?doc=${d.id}&store=${storeId}` },
                        { key: "tags", label: "Ценники позиций", href: `/stores/${storeId}/stock` },
                      ]}
                    />
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        Всего документов — {docs.length} на сумму {rub(total)}
      </p>
    </div>
  );
}
