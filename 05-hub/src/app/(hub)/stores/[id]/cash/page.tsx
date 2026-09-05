import { prisma } from "@/lib/prisma";
import { ensureStoreCash } from "@/lib/cash";
import { createManualCashTxn } from "@/actions/retail";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";
import { rub } from "@/lib/format";

export default async function CashPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureStoreCash(id);
  const registers = await prisma.cashRegister.findMany({
    where: { storeId: id },
    include: { txns: { orderBy: { occurredAt: "desc" }, take: 5 } },
  });
  const categories = await prisma.cashCategory.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <ul className="grid gap-3 sm:grid-cols-2">
        {registers.map((r) => (
          <li key={r.id} className="border border-border bg-card p-4">
            <p className="font-medium">{r.name}</p>
            <p className="mt-2 font-mono text-2xl">{rub(r.balance)}</p>
          </li>
        ))}
      </ul>

      <form action={createManualCashTxn} className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-2">
        <input type="hidden" name="storeId" value={id} />
        <div>
          <Label>Касса</Label>
          <select name="registerId" className="mt-1 flex h-9 w-full border border-input bg-background px-3 text-sm" required>
            {registers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Направление</Label>
          <select name="direction" className="mt-1 flex h-9 w-full border border-input bg-background px-3 text-sm" defaultValue="out">
            <option value="in">Приход</option>
            <option value="out">Расход</option>
          </select>
        </div>
        <div>
          <Label>Статья</Label>
          <select name="categoryName" className="mt-1 flex h-9 w-full border border-input bg-background px-3 text-sm">
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name} ({c.direction === "in" ? "+" : "−"})
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Сумма</Label>
          <Input name="amount" type="number" min={1} required />
        </div>
        <div>
          <Label>Получатель</Label>
          <Input name="recipient" />
        </div>
        <div>
          <Label>Примечание</Label>
          <Input name="note" />
        </div>
        <Button type="submit">Провести</Button>
      </form>
    </div>
  );
}
