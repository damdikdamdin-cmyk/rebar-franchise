import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { storeWhere } from "@/lib/access";
import { FORMAT_LABEL, KIND_LABEL, STORE_STATUS_LABEL, rub } from "@/lib/format";
import { Badge } from "@/components/ui/fields";

export default async function StoresPage() {
  const user = await requireUser();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const stores = await prisma.store.findMany({
    where: storeWhere(user),
    include: {
      partner: true,
      sales: { where: { soldAt: { gte: since } }, select: { amount: true } },
    },
    orderBy: [{ kind: "asc" }, { city: "asc" }],
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Розница</p>
        <h1 className="mt-1 font-serif text-4xl italic">Точки сети</h1>
      </header>
      <ul className="grid gap-3 md:grid-cols-2">
        {stores.map((store) => {
          const revenue = store.sales.reduce((s, x) => s + x.amount, 0);
          return (
            <li key={store.id}>
              <Link href={`/stores/${store.id}`} className="block border border-border bg-card p-5 hover:bg-accent">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{store.city}</p>
                    <p className="text-sm text-muted-foreground">{store.name}</p>
                  </div>
                  <Badge tone={store.status === "open" ? "open" : "steel"}>{STORE_STATUS_LABEL[store.status]}</Badge>
                </div>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {KIND_LABEL[store.kind]} · {FORMAT_LABEL[store.format]}
                </p>
                <p className="mt-1 font-mono text-sm">{rub(revenue)} за 30 дней</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
