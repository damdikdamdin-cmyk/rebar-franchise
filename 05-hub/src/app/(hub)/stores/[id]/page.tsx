import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { FORMAT_LABEL, KIND_LABEL, STORE_STATUS_LABEL, rub } from "@/lib/format";
import { Badge } from "@/components/ui/fields";

export default async function StoreOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const store = await prisma.store.findUniqueOrThrow({
    where: { id },
    include: {
      sales: { where: { soldAt: { gte: since } } },
      balances: true,
      cashRegisters: true,
      orders: { where: { status: "reserved" } },
    },
  });

  const revenue = store.sales.reduce((s, x) => s + x.amount, 0);
  const stockSku = store.balances.filter((b) => b.qty > 0).length;
  const cash = store.cashRegisters.reduce((s, r) => s + r.balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Badge>{KIND_LABEL[store.kind]}</Badge>
        <Badge tone="steel">{FORMAT_LABEL[store.format]}</Badge>
        <Badge tone={store.status === "open" ? "open" : "steel"}>{STORE_STATUS_LABEL[store.status]}</Badge>
      </div>

      <section className="grid gap-px bg-border sm:grid-cols-4">
        <Stat label="Выручка 30 дн" value={rub(revenue)} />
        <Stat label="Чеки" value={String(store.sales.length)} />
        <Stat label="SKU на складе" value={String(stockSku)} />
        <Stat label="Касса" value={rub(cash)} />
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["pos", "Продажи"],
          ["stock", "Остатки"],
          ["receipts", "Поступления"],
          ["orders", "Заказы"],
          ["transactions", "Транзакции"],
          ["reports", "Отчёты"],
        ].map(([slug, label]) => (
          <Link key={slug} href={`/stores/${id}/${slug}`} className="border border-border bg-card px-4 py-5 hover:bg-accent">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em]">{label}</p>
          </Link>
        ))}
      </div>

      {store.orders.length ? (
        <p className="text-sm text-muted-foreground">Открытых заказов: {store.orders.length}</p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-4 py-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xl">{value}</p>
    </div>
  );
}
