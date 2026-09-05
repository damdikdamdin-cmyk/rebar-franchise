import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isUk, ROLE_LABEL } from "@/lib/access";
import { Badge, Card, PageHeader, Stat } from "@/components/ui/fields";
import { FORMAT_LABEL, LEAD_STAGES, shortDate, STORE_STATUS_LABEL } from "@/lib/format";
import { courseProgress } from "@/lib/learning";

export default async function NetworkPage() {
  const user = await requireUser();
  if (!isUk(user.role)) redirect("/");
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 86400000);

  const [stores, partners, leads, launches, users, articles, overdueTasks] = await Promise.all([
    prisma.store.findMany({ include: { partner: true, staff: true }, orderBy: [{ status: "asc" }, { city: "asc" }] }),
    prisma.partner.findMany(),
    prisma.lead.findMany({ select: { stage: true, createdAt: true, budget: true } }),
    prisma.launchProject.findMany({ where: { status: "active" }, include: { tasks: true, store: true, partner: true } }),
    prisma.user.findMany({ include: { enrollments: { include: { course: { include: { lessons: true } }, progress: true } } } }),
    prisma.kbArticle.count({ where: { status: "published" } }),
    prisma.task.count({ where: { status: { in: ["pending", "in_progress"] }, dueAt: { lt: now } } }),
  ]);

  const open = stores.filter((s) => s.status === "open");
  const launchStores = stores.filter((s) => s.status === "launch");
  const leadsMonth = leads.filter((l) => l.createdAt >= monthAgo);
  const pipelineValue = leads.filter((l) => !["paid", "lost"].includes(l.stage)).reduce((s, l) => s + (l.budget ?? 0), 0);
  const overdueLaunch = launches.reduce(
    (n, p) => n + p.tasks.filter((t) => t.status !== "done" && t.status !== "skipped" && new Date(p.startedAt.getTime() + t.dueOffsetDays * 86400000) < now).length,
    0,
  );
  const enrollments = users.flatMap((u) => u.enrollments);
  const learnPct = enrollments.length ? Math.round(enrollments.reduce((s, e) => s + courseProgress(e).pct, 0) / enrollments.length) : 0;
  const rolesCount = users.reduce<Record<string, number>>((acc, u) => ((acc[u.role] = (acc[u.role] ?? 0) + 1), acc), {});

  return (
    <div>
      <PageHeader eyebrow={shortDate(now)} title="Сводка сети" description="Точки, партнёры, воронка, запуски, обучение — одним экраном." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Точек открыто" value={open.length} hint={`${launchStores.length} в запуске`} />
        <Stat label="Партнёров" value={partners.length} hint={`${partners.filter((p) => p.status === "onboarding").length} на онбординге`} />
        <Stat label="Заявок за 30 дней" value={leadsMonth.length} hint={pipelineValue ? `в работе на ${new Intl.NumberFormat("ru-RU").format(pipelineValue)} ₽` : undefined} />
        <Stat label="Обучение сети" value={`${learnPct}%`} hint={`${enrollments.filter((e) => e.completedAt).length}/${enrollments.length} курсов завершено`} />
        <Stat label="Активных запусков" value={launches.length} hint={overdueLaunch ? `${overdueLaunch} шагов просрочено` : "без просрочек"} />
        <Stat label="Просроченных задач" value={overdueTasks} />
        <Stat label="Статей в базе" value={articles} />
        <Stat label="Пользователей" value={users.length} hint={Object.entries(rolesCount).map(([r, n]) => `${ROLE_LABEL[r as keyof typeof ROLE_LABEL]} ${n}`).join(" · ")} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
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

        <section className="space-y-6">
          <div>
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
          </div>
          <div>
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
          </div>
        </section>
      </div>
    </div>
  );
}
