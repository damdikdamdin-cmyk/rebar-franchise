import { prisma } from "@/lib/prisma";
import { rub } from "@/lib/format";

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

  const rows = [...bySeller.values()];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Начисление за 30 дней: % с карточки товара / сотрудника + фикс ₽.</p>
      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3">Сотрудник</th>
              <th className="px-4 py-3">Чеки</th>
              <th className="px-4 py-3">Выручка</th>
              <th className="px-4 py-3">Комиссия</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{r.name}</td>
                <td className="px-4 py-3 font-mono">{r.checks}</td>
                <td className="px-4 py-3 font-mono">{rub(r.revenue)}</td>
                <td className="px-4 py-3 font-mono">{rub(r.commission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
