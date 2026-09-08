import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { rub } from "@/lib/format";
import { payCommission, updateStaffPay } from "@/actions/retail";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";
import { dayRange } from "@/lib/excel-csv";

export default async function PayrollPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { from, to, fromYmd, toYmd } = dayRange(sp.from, sp.to);

  const [sales, staff, shifts] = await Promise.all([
    prisma.sale.findMany({
      where: { storeId: id, soldAt: { gte: from, lte: to }, deletedAt: null },
      include: { seller: true, lines: { include: { product: true }, where: { deletedAt: null } } },
    }),
    prisma.user.findMany({
      where: {
        OR: [{ storeId: id }, { role: { in: ["seller", "store_manager"] }, storeId: id }],
      },
      orderBy: { name: "asc" },
    }),
    prisma.workShift.findMany({
      where: { storeId: id, date: { gte: from, lte: to }, deletedAt: null },
      include: { user: true },
    }),
  ]);

  // staff of this store (also include sellers who sold)
  const staffMap = new Map(staff.map((u) => [u.id, u]));
  for (const s of sales) {
    if (s.sellerUserId && s.seller && !staffMap.has(s.sellerUserId)) {
      staffMap.set(s.sellerUserId, s.seller);
    }
  }

  type Row = {
    userId: string;
    name: string;
    commissionPct: number;
    shiftPayRate: number;
    revenue: number;
    checks: number;
    commission: number;
    shiftsCount: number;
    shiftSalary: number;
    total: number;
  };

  const bySeller = new Map<string, Row>();

  for (const u of staffMap.values()) {
    bySeller.set(u.id, {
      userId: u.id,
      name: u.name,
      commissionPct: u.commissionPct ?? 0,
      shiftPayRate: u.shiftPay ?? 0,
      revenue: 0,
      checks: 0,
      commission: 0,
      shiftsCount: 0,
      shiftSalary: 0,
      total: 0,
    });
  }

  for (const sale of sales) {
    const key = sale.sellerUserId ?? "none";
    if (key === "none") continue;
    const seller = sale.seller;
    const row =
      bySeller.get(key) ??
      ({
        userId: key,
        name: seller?.name ?? "Без продавца",
        commissionPct: seller?.commissionPct ?? 0,
        shiftPayRate: seller?.shiftPay ?? 0,
        revenue: 0,
        checks: 0,
        commission: 0,
        shiftsCount: 0,
        shiftSalary: 0,
        total: 0,
      } satisfies Row);
    row.revenue += sale.amount;
    row.checks += 1;
    for (const line of sale.lines) {
      const pct =
        line.product?.commissionPct && line.product.commissionPct > 0
          ? line.product.commissionPct
          : row.commissionPct;
      const rubFixed = line.product?.commissionRub ?? 0;
      row.commission += Math.round((line.lineTotal * pct) / 100) + rubFixed * line.qty;
    }
    bySeller.set(key, row);
  }

  for (const sh of shifts) {
    const row = bySeller.get(sh.userId);
    if (!row) continue;
    row.shiftsCount += 1;
    row.shiftSalary += sh.shiftPay ?? row.shiftPayRate;
  }

  for (const row of bySeller.values()) {
    row.total = row.commission + row.shiftSalary;
  }

  const rows = [...bySeller.values()].filter((r) => r.total > 0 || r.checks > 0 || r.shiftsCount > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Зарплата</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Комиссия % от выручки + оклад за смены из графика
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/stores/${id}/schedule`}
            className="border border-border px-3 py-1.5 font-mono text-[10px] uppercase"
          >
            График
          </Link>
          <form className="flex gap-2">
            <input type="date" name="from" defaultValue={fromYmd} className="h-9 border border-input bg-background px-2 text-sm" />
            <input type="date" name="to" defaultValue={toYmd} className="h-9 border border-input bg-background px-2 text-sm" />
            <button type="submit" className="h-9 border border-border px-3 font-mono text-[10px] uppercase">
              Период
            </button>
          </form>
        </div>
      </div>

      <section className="border border-border bg-card p-4">
        <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Ставки сотрудников точки
        </h3>
        <ul className="divide-y divide-border border border-border">
          {[...staffMap.values()].map((u) => (
            <li key={u.id} className="px-3 py-3">
              <form action={updateStaffPay} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="storeId" value={id} />
                <input type="hidden" name="userId" value={u.id} />
                <div className="min-w-[140px] flex-1">
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{u.email}</p>
                </div>
                <div>
                  <Label>% от выручки</Label>
                  <Input
                    name="commissionPct"
                    inputMode="decimal"
                    defaultValue={u.commissionPct ? String(u.commissionPct) : "0.5"}
                    className="w-24"
                  />
                </div>
                <div>
                  <Label>Оклад за смену, ₽</Label>
                  <Input
                    name="shiftPay"
                    inputMode="numeric"
                    defaultValue={u.shiftPay ? String(u.shiftPay) : "2000"}
                    className="w-28"
                  />
                </div>
                <Button type="submit" size="sm" variant="outline">
                  Сохранить
                </Button>
              </form>
            </li>
          ))}
          {!staffMap.size ? (
            <li className="px-3 py-4 text-sm text-muted-foreground">Нет сотрудников, привязанных к точке</li>
          ) : null}
        </ul>
      </section>

      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3">Сотрудник</th>
              <th className="px-4 py-3">Чеки</th>
              <th className="px-4 py-3">Выручка</th>
              <th className="px-4 py-3">Комиссия</th>
              <th className="px-4 py-3">Смены</th>
              <th className="px-4 py-3">Оклад</th>
              <th className="px-4 py-3">Итого</th>
              <th className="px-4 py-3">Выплата</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-sm text-muted-foreground">
                  Начислений за период нет — нужны продажи и/или смены в графике.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.userId} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p>{r.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {r.commissionPct}% · смена {rub(r.shiftPayRate)}
                  </p>
                </td>
                <td className="px-4 py-3 font-mono">{r.checks}</td>
                <td className="px-4 py-3 font-mono">{rub(r.revenue)}</td>
                <td className="px-4 py-3 font-mono">{rub(r.commission)}</td>
                <td className="px-4 py-3 font-mono">{r.shiftsCount}</td>
                <td className="px-4 py-3 font-mono">{rub(r.shiftSalary)}</td>
                <td className="px-4 py-3 font-mono font-medium">{rub(r.total)}</td>
                <td className="px-4 py-3">
                  <form action={payCommission} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="storeId" value={id} />
                    <input type="hidden" name="recipient" value={r.name} />
                    <Input name="amount" inputMode="numeric" defaultValue={String(r.total)} className="h-8 w-28" required />
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
