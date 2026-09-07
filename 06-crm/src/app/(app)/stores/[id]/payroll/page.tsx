import { prisma } from "@/lib/prisma";
import { rub } from "@/lib/format";
import { payCommission } from "@/actions/retail";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";

export default async function PayrollPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const sales = await prisma.sale.findMany({
    where: { storeId: id, soldAt: { gte: since } },
    include: { seller: true, lines: { include: { product: true } } },
  });

  const bySeller = new Map<
    string,
    { name: string; revenue: number; commission: number; checks: number }
  >();

  for (const sale of sales) {
    const key = sale.sellerUserId ?? "none";
    const name = sale.seller?.name ?? "Без продавца";
    const row = bySeller.get(key) ?? { name, revenue: 0, commission: 0, checks: 0 };
    row.revenue += sale.amount;
    row.checks += 1;
    for (const line of sale.lines) {
      const pct = line.product?.commissionPct ?? sale.seller?.commissionPct ?? 0;
      const rubFixed = line.product?.commissionRub ?? 0;
      row.commission += Math.round((line.lineTotal * pct) / 100) + rubFixed * line.qty;
    }
    bySeller.set(key, row);
  }

  const rows = [...bySeller.values()].filter((r) => r.commission > 0);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Начисление за 30 дней: % с карточки товара / сотрудника + фикс ₽. Выплата списывает сумму из кассы точки.
      </p>
      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3">Сотрудник</th>
              <th className="px-4 py-3">Чеки</th>
              <th className="px-4 py-3">Выручка</th>
              <th className="px-4 py-3">Комиссия</th>
              <th className="px-4 py-3">Выплата</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-sm text-muted-foreground">
                  Начислений за период нет.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{r.name}</td>
                <td className="px-4 py-3 font-mono">{r.checks}</td>
                <td className="px-4 py-3 font-mono">{rub(r.revenue)}</td>
                <td className="px-4 py-3 font-mono">{rub(r.commission)}</td>
                <td className="px-4 py-3">
                  <form action={payCommission} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="storeId" value={id} />
                    <input type="hidden" name="recipient" value={r.name} />
                    <div>
                      <Label className="sr-only">Сумма</Label>
                      <Input name="amount" type="number" defaultValue={r.commission} className="h-8 w-28" required />
                    </div>
                    <Button type="submit" size="sm" variant="outline">
                      Выплатить
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
