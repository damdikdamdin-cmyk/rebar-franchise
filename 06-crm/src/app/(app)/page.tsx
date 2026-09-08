import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  canAccessMarketing,
  canAccessPipeline,
  canAccessRetail,
  isUk,
  launchWhere,
  partnerWhere,
  roleCanSee,
  STORE_ROLES,
  storeWhere,
} from "@/lib/access";
import { Badge, Card, Empty, Stat } from "@/components/ui/fields";
import { LEAD_STAGE_LABEL, relativeDays, rub, shortDate, TASK_STATUS_LABEL } from "@/lib/format";
import { courseProgress } from "@/lib/learning";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const retailDays = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const retailFrom = new Date(now.getTime() - retailDays * 86400000);
  const showRetail = canAccessRetail(user.role);

  const [tasks, enrollments, launches, leadsNew, leadsWeek, partnersOnboarding, recentArticles, contentWeek, stores, sales] =
    await Promise.all([
      prisma.task.findMany({
        where: { assigneeId: user.id, status: { in: ["pending", "in_progress"] } },
        orderBy: [{ dueAt: "asc" }],
        take: 6,
        include: { lead: true, partner: true },
      }),
      prisma.enrollment.findMany({
        where: { userId: user.id, completedAt: null },
        include: { course: { include: { lessons: true } }, progress: true },
        take: 3,
      }),
      prisma.launchProject.findMany({
        where: { ...launchWhere(user), status: "active" },
        include: { partner: true, store: true, tasks: true },
        orderBy: { startedAt: "desc" },
        take: 5,
      }),
      canAccessPipeline(user.role) ? prisma.lead.count({ where: { stage: "new" } }) : 0,
      canAccessPipeline(user.role) ? prisma.lead.count({ where: { createdAt: { gte: weekAgo } } }) : 0,
      isUk(user.role) ? prisma.partner.count({ where: { status: "onboarding" } }) : 0,
      prisma.kbArticle.findMany({
        where: { status: "published" },
        orderBy: { updatedAt: "desc" },
        take: 6,
        include: { space: true },
      }),
      canAccessMarketing(user.role)
        ? prisma.contentItem.count({
            where: {
              publishAt: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) },
              status: { not: "published" },
            },
          })
        : 0,
      showRetail
        ? prisma.store.findMany({
            where: { ...storeWhere(user), status: { in: ["open", "launch"] } },
            orderBy: [{ city: "asc" }, { name: "asc" }],
          })
        : Promise.resolve([]),
      showRetail
        ? prisma.sale.findMany({
            where: {
              soldAt: { gte: retailFrom },
              deletedAt: null,
              store: storeWhere(user),
            },
            include: {
              lines: { where: { deletedAt: null } },
              store: { select: { id: true, city: true, name: true } },
            },
          })
        : Promise.resolve([]),
    ]);

  const partner = user.partnerId
    ? await prisma.partner.findUnique({ where: partnerWhere(user) as { id: string } })
    : null;
  const articles = recentArticles.filter(
    (a) => roleCanSee(user.role, a.space.visibleRoles) && roleCanSee(user.role, a.visibleRoles),
  );

  type CityRow = {
    storeId: string;
    city: string;
    name: string;
    revenue: number;
    cost: number;
    profit: number;
    qty: number;
    checks: number;
  };

  const byCityMap = new Map<string, CityRow>();
  for (const store of stores) {
    byCityMap.set(store.id, {
      storeId: store.id,
      city: store.city,
      name: store.name,
      revenue: 0,
      cost: 0,
      profit: 0,
      qty: 0,
      checks: 0,
    });
  }
  for (const sale of sales) {
    const row = byCityMap.get(sale.storeId) ?? {
      storeId: sale.storeId,
      city: sale.store.city,
      name: sale.store.name,
      revenue: 0,
      cost: 0,
      profit: 0,
      qty: 0,
      checks: 0,
    };
    row.revenue += sale.amount;
    row.checks += 1;
    for (const line of sale.lines) {
      row.cost += (line.costPrice || 0) * line.qty;
      row.qty += line.qty;
    }
    row.profit = row.revenue - row.cost;
    byCityMap.set(sale.storeId, row);
  }
  const byCity = [...byCityMap.values()].sort(
    (a, b) => b.revenue - a.revenue || a.city.localeCompare(b.city, "ru"),
  );
  const totals = byCity.reduce(
    (acc, r) => {
      acc.revenue += r.revenue;
      acc.profit += r.profit;
      acc.qty += r.qty;
      acc.checks += r.checks;
      return acc;
    },
    { revenue: 0, profit: 0, qty: 0, checks: 0 },
  );

  const hour = now.getHours();
  const greeting = hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">{shortDate(now)}</p>
        <h1 className="display mt-1 text-5xl">
          {greeting}, {user.name?.split(" ")[0]}.
        </h1>
        {partner ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {partner.city} · {partner.name}
          </p>
        ) : null}
      </div>

      {showRetail ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="eyebrow">Розница по городам</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Выручка · валовая прибыль · позиции за {retailDays} дн.
              </p>
            </div>
            <div className="flex gap-1 font-mono text-[11px]">
              {[7, 30, 90].map((d) => (
                <Link
                  key={d}
                  href={d === 30 ? "/" : `/?days=${d}`}
                  className={`rounded-md px-2 py-1 ${
                    retailDays === d ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {d}д
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label={`Выручка · ${retailDays} дн`} value={rub(totals.revenue)} hint={`${totals.checks} чеков`} />
            <Stat
              label="Валовая прибыль"
              value={rub(totals.profit)}
              hint={totals.revenue ? `${Math.round((totals.profit / totals.revenue) * 100)}% от выручки` : undefined}
            />
            <Stat label="Позиций продано" value={totals.qty} hint="шт. в чеках" />
          </div>

          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3">Город · точка</th>
                  <th className="px-4 py-3">Выручка</th>
                  <th className="px-4 py-3">Валовая прибыль</th>
                  <th className="px-4 py-3">Позиций</th>
                  <th className="px-4 py-3">Чеки</th>
                </tr>
              </thead>
              <tbody>
                {!byCity.length ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-muted-foreground">
                      Точек в зоне доступа нет
                    </td>
                  </tr>
                ) : null}
                {byCity.map((r) => (
                  <tr key={r.storeId} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/stores/${r.storeId}`} className="underline-offset-4 hover:underline">
                        {r.city} · {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono">{rub(r.revenue)}</td>
                    <td className="px-4 py-3 font-mono">
                      {rub(r.profit)}
                      {r.revenue ? (
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          {Math.round((r.profit / r.revenue) * 100)}%
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono">{r.qty}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{r.checks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      ) : null}

      {isUk(user.role) ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {canAccessPipeline(user.role) ? (
            <>
              <Stat label="Новые заявки" value={leadsNew} hint="ждут первого контакта" />
              <Stat label="Заявок за 7 дней" value={leadsWeek} />
            </>
          ) : null}
          <Stat label="Партнёров в запуске" value={partnersOnboarding} />
          <Stat label="Активных запусков" value={launches.length} />
          {canAccessMarketing(user.role) ? <Stat label="Публикаций на неделе" value={contentWeek} /> : null}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="eyebrow">Мои задачи</h2>
              <Link href="/tasks" className="eyebrow underline underline-offset-4">
                Все
              </Link>
            </div>
            {tasks.length === 0 ? (
              <Empty title="Задач нет" hint="Новые задачи появятся здесь и в инбоксе." />
            ) : (
              <Card className="divide-y divide-border">
                {tasks.map((t) => {
                  const overdue = t.dueAt && t.dueAt < now;
                  return (
                    <Link
                      key={t.id}
                      href={`/tasks?focus=${t.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm">{t.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t.lead
                            ? `Лид: ${t.lead.name}`
                            : t.partner
                              ? `Партнёр: ${t.partner.name}`
                              : TASK_STATUS_LABEL[t.status]}
                        </p>
                      </div>
                      {t.dueAt ? (
                        <Badge tone={overdue ? "warn" : "steel"}>{relativeDays(t.dueAt)}</Badge>
                      ) : null}
                    </Link>
                  );
                })}
              </Card>
            )}
          </section>

          {launches.length ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="eyebrow">Запуски</h2>
                <Link href="/launches" className="eyebrow underline underline-offset-4">
                  Все
                </Link>
              </div>
              <Card className="divide-y divide-border">
                {launches.map((l) => {
                  const done = l.tasks.filter((t) => t.status === "done").length;
                  const overdue = l.tasks.filter(
                    (t) =>
                      t.status !== "done" &&
                      t.status !== "skipped" &&
                      new Date(l.startedAt.getTime() + t.dueOffsetDays * 86400000) < now,
                  ).length;
                  return (
                    <Link
                      key={l.id}
                      href={`/launches/${l.id}`}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-accent"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          {l.store.city} · {l.partner.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {done}/{l.tasks.length} шагов · старт {shortDate(l.startedAt)}
                        </p>
                      </div>
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-foreground"
                          style={{ width: `${(done / Math.max(1, l.tasks.length)) * 100}%` }}
                        />
                      </div>
                      {overdue ? <Badge tone="warn">{overdue} просрочено</Badge> : null}
                    </Link>
                  );
                })}
              </Card>
            </section>
          ) : null}

          {STORE_ROLES.includes(user.role) ? (
            <Card className="flex items-center justify-between gap-4 px-5 py-5">
              <div>
                <p className="eyebrow">Смена</p>
                <p className="display mt-1 text-2xl">Чек-лист рабочего дня</p>
              </div>
              <Link href="/day" className="rounded-md bg-foreground px-4 py-2 text-sm text-background">
                Открыть
              </Link>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="eyebrow">Обучение</h2>
              <Link href="/learn" className="eyebrow underline underline-offset-4">
                Все курсы
              </Link>
            </div>
            {enrollments.length === 0 ? (
              <Empty title="Активных курсов нет" />
            ) : (
              <div className="space-y-2">
                {enrollments.map((e) => {
                  const p = courseProgress(e);
                  return (
                    <Link
                      key={e.id}
                      href={`/learn/${e.course.slug}`}
                      className="block rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm">{e.course.title}</p>
                        <span className="font-mono text-xs">{p.pct}%</span>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-foreground" style={{ width: `${p.pct}%` }} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="eyebrow">База знаний · обновления</h2>
              <Link href="/kb" className="eyebrow underline underline-offset-4">
                Открыть
              </Link>
            </div>
            <Card className="divide-y divide-border">
              {articles.slice(0, 5).map((a) => (
                <Link key={a.id} href={`/kb/${a.slug}`} className="block px-4 py-2.5 hover:bg-accent">
                  <p className="truncate text-sm">{a.title}</p>
                  <p className="eyebrow mt-0.5">{a.space.name}</p>
                </Link>
              ))}
            </Card>
          </section>

          {canAccessPipeline(user.role) && leadsNew ? (
            <Card className="px-4 py-4">
              <p className="eyebrow">Воронка</p>
              <p className="mt-1 text-sm">
                {leadsNew} заявок в стадии «{LEAD_STAGE_LABEL.new}».{" "}
                <Link href="/pipeline" className="underline underline-offset-4">
                  Разобрать
                </Link>
              </p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
