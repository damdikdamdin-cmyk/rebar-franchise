import { prisma } from "@/lib/prisma";
import { ensureStoreCash } from "@/lib/cash";
import { dateTime, rub } from "@/lib/format";

export default async function TransactionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureStoreCash(id);
  const registers = await prisma.cashRegister.findMany({ where: { storeId: id }, select: { id: true } });
  const txns = await prisma.cashTxn.findMany({
    where: { registerId: { in: registers.map((r) => r.id) } },
    include: { register: true, category: true, user: true },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3">Дата</th>
              <th className="px-4 py-3">Сумма</th>
              <th className="px-4 py-3">Статья</th>
              <th className="px-4 py-3">Касса</th>
              <th className="px-4 py-3">Остаток</th>
              <th className="px-4 py-3">Сотрудник</th>
              <th className="px-4 py-3">Примечание</th>
            </tr>
          </thead>
          <tbody>
            {txns.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{dateTime(t.occurredAt)}</td>
                <td className={`px-4 py-3 font-mono ${t.direction === "in" ? "text-foreground" : "text-destructive"}`}>
                  {t.direction === "in" ? "+" : "−"}
                  {rub(t.amount)}
                </td>
                <td className="px-4 py-3">{t.category?.name ?? "—"}</td>
                <td className="px-4 py-3">{t.register.name}</td>
                <td className="px-4 py-3 font-mono">{rub(t.balanceAfter)}</td>
                <td className="px-4 py-3">{t.user?.name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.note ?? t.recipient ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        Всего транзакций: {txns.length}
      </p>
    </div>
  );
}
