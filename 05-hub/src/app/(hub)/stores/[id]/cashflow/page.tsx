import { prisma } from "@/lib/prisma";
import { ensureStoreCash } from "@/lib/cash";
import { rub } from "@/lib/format";

export default async function CashflowPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year ?? now.getFullYear());
  const month = Number(sp.month ?? now.getMonth() + 1);
  await ensureStoreCash(id);

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const registers = await prisma.cashRegister.findMany({ where: { storeId: id }, select: { id: true } });
  const txns = await prisma.cashTxn.findMany({
    where: {
      registerId: { in: registers.map((r) => r.id) },
      occurredAt: { gte: start, lt: end },
    },
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  const income = Array(daysInMonth).fill(0) as number[];
  const expense = Array(daysInMonth).fill(0) as number[];
  for (const t of txns) {
    const day = t.occurredAt.getDate() - 1;
    if (t.direction === "in") income[day] += t.amount;
    else expense[day] += t.amount;
  }
  const incomeTotal = income.reduce((a, b) => a + b, 0);
  const expenseTotal = expense.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2">
        <select name="year" defaultValue={year} className="h-9 border border-input bg-background px-3 text-sm">
          {[year - 1, year, year + 1].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select name="month" defaultValue={month} className="h-9 border border-input bg-background px-3 text-sm">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button type="submit" className="h-9 border border-border px-3 font-mono text-[11px] uppercase">
          Показать
        </button>
      </form>

      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[900px] text-xs">
          <thead className="font-mono text-[10px] uppercase text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-2 py-2 text-left">Статья</th>
              {Array.from({ length: daysInMonth }, (_, i) => (
                <th key={i} className="px-1 py-2">
                  {i + 1}
                </th>
              ))}
              <th className="px-2 py-2">Всего</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="px-2 py-2">Доход</td>
              {income.map((v, i) => (
                <td key={i} className="px-1 py-2 font-mono">
                  {v ? Math.round(v / 1000) : ""}
                </td>
              ))}
              <td className="px-2 py-2 font-mono">{rub(incomeTotal)}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-2 py-2">Расход</td>
              {expense.map((v, i) => (
                <td key={i} className="px-1 py-2 font-mono">
                  {v ? Math.round(v / 1000) : ""}
                </td>
              ))}
              <td className="px-2 py-2 font-mono">{rub(expenseTotal)}</td>
            </tr>
            <tr>
              <td className="px-2 py-2">Итоги</td>
              {income.map((v, i) => (
                <td key={i} className="px-1 py-2 font-mono">
                  {v - expense[i] ? Math.round((v - expense[i]) / 1000) : ""}
                </td>
              ))}
              <td className="px-2 py-2 font-mono">{rub(incomeTotal - expenseTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">В ячейках по дням — тысячи ₽ (для компактности).</p>
    </div>
  );
}
