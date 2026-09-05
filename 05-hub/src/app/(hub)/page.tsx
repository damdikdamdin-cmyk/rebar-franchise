import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canAccessPipeline, isUk, storeWhere } from "@/lib/access";
import { FORMAT_LABEL, KIND_LABEL, rub, shortDate } from "@/lib/format";
import { Badge } from "@/components/ui/fields";

export default async function DashboardPage() {
  const user = await requireUser();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const stores = await prisma.store.findMany({
    where: storeWhere(user),
    include: {
      partner: true,
      sales: { where: { soldAt: { gte: since } } },
    },
    orderBy: { city: "asc" },
  });

  const rows = stores.map((store) => {
    const revenue = store.sales.reduce((s, x) => s + x.amount, 0);
    const credit = store.sales.reduce((s, x) => s + x.creditAmount, 0);
    const checks = store.sales.length;
    return {
      ...store,
      revenue,
      credit,
      checks,
      avg: checks ? Math.round(revenue / checks) : 0,
    };
  });

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalChecks = rows.reduce((s, r) => s + r.checks, 0);
  const totalAvg = totalChecks ? Math.round(totalRevenue / totalChecks) : 0;

  const pipelineCounts = canAccessPipeline(user.role)
    ? await prisma.lead.groupBy({ by: ["stage"], _count: true })
    : [];
  const openLeads = pipelineCounts
    .filter((x) => x.stage !== "paid" && x.stage !== "lost")
    .reduce((s, x) => s + x._count, 0);

  const launches = isUk(user.role) || user.role === "partner"
    ? await prisma.launchProject.findMany({
        where: {
          status: "active",
          ...(isUk(user.role) ? {} : { partnerId: user.partnerId ?? "__none__" }),
        },
        include: { store: true, partner: true, tasks: true },
      })
    : [];

  return (
    <div className="space-y-8">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Сводка сети · 30 дней</p>
        <h1 className="mt-1 font-serif text-4xl italic">Цифры точек в одном месте.</h1>
      </header>

      <section className="grid gap-px bg-border sm:grid-cols-3">
        <Stat label="Выручка" value={rub(totalRevenue)} />
        <Stat label="Чеки" value={String(totalChecks)} />
        <Stat label="Средний чек" value={rub(totalAvg)} />
      </section>

      {canAccessPipeline(user.role) ? (
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
          Воронка УК: {openLeads} заявок в работе
        </p>
      ) : null}

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Точки</h2>
        </div>
        <div className="overflow-x-auto border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3">Точка</th>
                <th className="px-4 py-3">Тип</th>
                <th className="px-4 py-3">Выручка</th>
                <th className="px-4 py-3">Чеки</th>
                <th className="px-4 py-3">Ср. чек</th>
                <th className="px-4 py-3">Lendo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/stores/${row.id}`} className="hover:underline">
                      {row.city}
                    </Link>
                    <div className="text-xs text-muted-foreground">{row.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="steel">
                      {KIND_LABEL[row.kind]} · {FORMAT_LABEL[row.format]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono">{rub(row.revenue)}</td>
                  <td className="px-4 py-3 font-mono">{row.checks}</td>
                  <td className="px-4 py-3 font-mono">{rub(row.avg)}</td>
                  <td className="px-4 py-3 font-mono">{rub(row.credit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {launches.length > 0 ? (
        <section>
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Запуски</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {launches.map((project) => {
              const done = project.tasks.filter((t) => t.status === "done").length;
              return (
                <li key={project.id} className="border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{project.store.city}</p>
                      <p className="text-sm text-muted-foreground">{project.partner.name}</p>
                    </div>
                    <Badge>
                      {done}/{project.tasks.length}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Старт {shortDate(project.startedAt)}
                    {project.targetOpenAt ? ` · план открытия ${shortDate(project.targetOpenAt)}` : ""}
                  </p>
                  <Link href={`/partners/${project.partnerId}/launch`} className="mt-3 inline-block text-sm underline">
                    Чеклист запуска
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-5 py-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-2xl tracking-tight">{value}</p>
    </div>
  );
}
