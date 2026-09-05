import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { dateTime, rub } from "@/lib/format";

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const to = sp.to ? new Date(sp.to) : new Date();
  const from = sp.from ? new Date(sp.from) : new Date(to.getTime() - 30 * 86400000);

  const sales = await prisma.sale.findMany({
    where: { storeId: id, soldAt: { gte: from, lte: to } },
    include: { seller: true, lines: true, customer: true },
    orderBy: { soldAt: "desc" },
  });

  const revenue = sales.reduce((s, x) => s + x.amount, 0);
  const byProduct = new Map<string, { name: string; qty: number; amount: number }>();
  for (const sale of sales) {
    for (const line of sale.lines) {
      const key = line.productId ?? line.name;
      const row = byProduct.get(key) ?? { name: line.name, qty: 0, amount: 0 };
      row.qty += line.qty;
      row.amount += line.lineTotal;
      byProduct.set(key, row);
    }
  }

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap gap-2">
        <input type="date" name="from" defaultValue={from.toISOString().slice(0, 10)} className="h-9 border border-input bg-background px-2 text-sm" />
        <input type="date" name="to" defaultValue={to.toISOString().slice(0, 10)} className="h-9 border border-input bg-background px-2 text-sm" />
        <button type="submit" className="h-9 border border-border px-3 font-mono text-[11px] uppercase">
          Построить отчёт
        </button>
      </form>

      <section className="grid gap-px bg-border sm:grid-cols-3">
        <div className="bg-card px-4 py-5">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Выручка</p>
          <p className="mt-1 font-mono text-xl">{rub(revenue)}</p>
        </div>
        <div className="bg-card px-4 py-5">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Чеки</p>
          <p className="mt-1 font-mono text-xl">{sales.length}</p>
        </div>
        <div className="bg-card px-4 py-5">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Средний чек</p>
          <p className="mt-1 font-mono text-xl">{rub(sales.length ? revenue / sales.length : 0)}</p>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Товары</h2>
        <ul className="divide-y divide-border border border-border bg-card">
          {[...byProduct.values()]
            .sort((a, b) => b.amount - a.amount)
            .map((r) => (
              <li key={r.name} className="flex justify-between px-4 py-2 text-sm">
                <span>
                  {r.name} × {r.qty}
                </span>
                <span className="font-mono">{rub(r.amount)}</span>
              </li>
            ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Чеки</h2>
        <ul className="divide-y divide-border border border-border bg-card">
          {sales.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <p className="font-mono">{s.number ?? s.id.slice(0, 8)}</p>
                <p className="text-xs text-muted-foreground">
                  {dateTime(s.soldAt)} · {s.seller?.name ?? "—"} · {s.customer?.name ?? "розница"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono">{rub(s.amount)}</span>
                <Link href={`/stores/${id}/print/sale/${s.id}`} className="underline">
                  Печать
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
