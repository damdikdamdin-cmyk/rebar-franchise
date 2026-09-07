import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isUk, ROLE_LABEL } from "@/lib/access";
import { Badge, Card, PageHeader, Stat } from "@/components/ui/fields";
import { FORMAT_LABEL, LEAD_STAGES, rub, shortDate, STORE_STATUS_LABEL } from "@/lib/format";
import { courseProgress } from "@/lib/learning";

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const user = await requireUser();
  if (!isUk(user.role)) redirect("/");
  const { days: daysRaw } = await searchParams;
  const days = [7, 30, 90].includes(Number(daysRaw)) ? Number(daysRaw) : 30;
  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 86400000);
  const prevStart = new Date(periodStart.getTime() - days * 86400000);

  const [stores, partners, leads, launches, users, articles, overdueTasks, sales, prevSales] = await Promise.all([
    prisma.store.findMany({ include: { partner: true, staff: true }, orderBy: [{ status: "asc" }, { city: "asc" }] }),
    prisma.partner.findMany(),
    prisma.lead.findMany({ select: { stage: true, createdAt: true, budget: true } }),
    prisma.launchProject.findMany({ where: { status: "active" }, include: { tasks: true, store: true, partner: true } }),
    prisma.user.findMany({ include: { enrollments: { include: { course: { include: { lessons: true } }, progress: true } } } }),
    prisma.kbArticle.count({ where: { status: "published" } }),
    prisma.task.count({ where: { status: { in: ["pending", "in_progress"] }, dueAt: { lt: now } } }),
    prisma.sale.findMany({
      where: { soldAt: { gte: periodStart }, deletedAt: null },
      include: { lines: true, store: { select: { id: true, name: true, city: true } } },
    }),
    prisma.sale.findMany({
      where: { soldAt: { gte: prevStart, lt: periodStart }, deletedAt: null },
      select: { amount: true, creditAmount: true },
    }),
  ]);

  const open = stores.filter((s) => s.status === "open");
  const launchStores = stores.filter((s) => s.status === "launch");
  const leadsPeriod = leads.filter((l) => l.createdAt >= periodStart);
  const pipelineValue = leads.filter((l) => !["paid", "lost"].includes(l.stage)).reduce((s, l) => s + (l.budget ?? 0), 0);
  const overdueLaunch = launches.reduce(
    (n, p) =>
      n +
      p.tasks.filter(
        (t) =>
          t.status !== "done" &&
          t.status !== "skipped" &&
          new Date(p.startedAt.getTime() + t.dueOffsetDays * 86400000) < now,
      ).length,
    0,
  );
  const enrollments = users.flatMap((u) => u.enrollments);
  const learnPct = enrollments.length
    ? Math.round(enrollments.reduce((s, e) => s + courseProgress(e).pct, 0) / enrollments.length)
    : 0;
  const rolesCount = users.reduce<Record<string, number>>((acc, u) => ((acc[u.role] = (acc[u.role] ?? 0) + 1), acc), {});

  const retailRevenue = sales.reduce((s, sale) => s + sale.amount, 0);
  const lendo = sales.reduce((s, sale) => s + sale.creditAmount, 0);
  const prevRevenue = prevSales.reduce((s, sale) => s + sale.amount, 0);
  const retailChecks = sales.length;
  const avgCheck = retailChecks ? Math.round(retailRevenue / retailChecks) : 0;
  const deltaPct = prevRevenue ? Math.round(((retailRevenue - prevRevenue) / prevRevenue) * 100) : null;

  const byStore = stores
    .map((store) => {
      const storeSales = sales.filter((s) => s.storeId === store.id);
      const revenue = storeSales.reduce((sum, s) => sum + s.amount, 0);
      const credit = storeSales.reduce((sum, s) => sum + s.creditAmount, 0);
      return { store, revenue, credit, checks: storeSales.length };
    })
    .filter((row) => row.checks > 0 || row.store.status === "open")
    .sort((a, b) => b.revenue - a.revenue);

  const productTotals = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const sale of sales) {
    for (const line of sale.lines) {
      const key = line.productId ?? line.name;
      const prev = productTotals.get(key) ?? { name: line.name, qty: 0, revenue: 0 };
      prev.qty += line.qty;
      prev.revenue += line.lineTotal;
      productTotals.set(key, prev);
    }
  }
  const topProducts = [...productTotals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  return (
    <div>
      <PageHeader
        eyebrow={shortDate(now)}
        title="Сводка сети"
        description="Точки, партнёры, воронка, запуски, розница и обучение — одним экраном."
        actions={
          <div className="flex gap-1 font-mono text-[11px]">
            {[7, 30, 90].map((d) => (
              <Link
                key={d}
                href={`/network?days=${d}`}
                className={`rounded-md px-2 py-1 ${days === d ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent"}`}
              >
                {d}д
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Точек открыто" value={open.length} hint={`${launchStores.length} в запуске`} />
        <Stat
          label="Партнёров"
          value={partners.length}
          hint={`${partners.filter((p) => p.status === "onboarding").length} на онбординге`}
        />
        <Stat
          label={`Заявок · ${days} дн`}
          value={leadsPeriod.length}
          hint={pipelineValue ? `в работе на ${new Intl.NumberFormat("ru-RU").format(pipelineValue)} ₽` : undefined}
        />
        <Stat
          label="Обучение сети"
          value={`${learnPct}%`}
          hint={`${enrollments.filter((e) => e.completedAt).length}/${enrollments.length} курсов завершено`}
        />
        <Stat
          label={`Выручка · ${days} дн`}
          value={rub(retailRevenue)}
          hint={`${retailChecks} чеков · ср. ${rub(avgCheck)}${deltaPct !== null ? ` · ${deltaPct > 0 ? "+" : ""}${deltaPct}% к пред.` : ""}`}
        />
        <Stat
          label="Lendo / кредит"
          value={rub(lendo)}
          hint={retailRevenue ? `${Math.round((lendo / retailRevenue) * 100)}% выручки` : "нет продаж"}
        />
        <Stat label="Активных запусков" value={launches.length} hint={overdueLaunch ? `${overdueLaunch} шагов просрочено` : "без просрочек"} />
        <Stat label="Просроченных задач" value={overdueTasks} hint={`${articles} статей · ${users.length} пользователей`} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <p className="eyebrow mb-2">Розница по точкам · {days} дней</p>
          <Card className="divide-y divide-border">
            {byStore.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">Продаж за период нет.</p> : null}
            {byStore.map(({ store, revenue, credit, checks }) => (
              <Link key={store.id} href={`/stores/${store.id}/reports`} className="flex items-center gap-3 px-4 py-3 hover:bg-accent">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    {store.city} · {store.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {checks} чеков{credit ? ` · Lendo ${rub(credit)}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm">{rub(revenue)}</span>
                  {retailRevenue > 0 ? (
                    <p className="font-mono text-[10px] text-muted-foreground">{Math.round((revenue / retailRevenue) * 100)}%</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </Card>
          {topProducts.length > 0 ? (
            <div className="mt-6">
              <p className="eyebrow mb-2">Топ товаров</p>
              <Card className="divide-y divide-border">
                {topProducts.map((p) => (
                  <div key={p.name} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.qty} шт.</p>
                    </div>
                    <span className="font-mono text-xs">{rub(p.revenue)}</span>
                  </div>
                ))}
              </Card>
            </div>
          ) : null}
        </section>

        <section>
          <p className="eyebrow mb-2">Карта сети</p>
          <Card className="divide-y divide-border">
            {stores.map((s) => (
              <Link key={s.id} href={`/stores/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-accent">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    {s.city} · {s.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {FORMAT_LABEL[s.format]} · {s.partner ? s.partner.name : "УК"} · {s.staff.length} чел.
                  </p>
                </div>
                <Badge tone={s.status === "open" ? "success" : "steel"}>{STORE_STATUS_LABEL[s.status]}</Badge>
              </Link>
            ))}
          </Card>
        </section>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <p className="eyebrow mb-2">Воронка по стадиям</p>
          <Card className="px-4 py-3">
            {LEAD_STAGES.map((s) => {
              const n = leads.filter((l) => l.stage === s.id).length;
              return (
                <div key={s.id} className="flex items-center gap-3 py-1 text-sm">
                  <span className="w-28 text-xs">{s.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-foreground" style={{ width: `${(n / Math.max(1, leads.length)) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right font-mono text-xs">{n}</span>
                </div>
              );
            })}
          </Card>
        </section>
        <section>
          <p className="eyebrow mb-2">Запуски</p>
          <Card className="divide-y divide-border">
            {launches.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">Активных запусков нет.</p> : null}
            {launches.map((p) => {
              const done = p.tasks.filter((t) => t.status === "done").length;
              return (
                <Link key={p.id} href={`/launches/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-accent">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      {p.store.city} · {p.partner.name}
                    </p>
                    <p className="text-xs text-muted-foreground">день {Math.floor((now.getTime() - p.startedAt.getTime()) / 86400000)}</p>
                  </div>
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-foreground" style={{ width: `${(done / p.tasks.length) * 100}%` }} />
                  </div>
                  <span className="font-mono text-xs">
                    {done}/{p.tasks.length}
                  </span>
                </Link>
              );
            })}
          </Card>
          <p className="mt-3 text-xs text-muted-foreground">
            Состав команды:{" "}
            {Object.entries(rolesCount)
              .map(([r, n]) => `${ROLE_LABEL[r as keyof typeof ROLE_LABEL]} ${n}`)
              .join(" · ")}
          </p>
        </section>
      </div>
    </div>
  );
}
