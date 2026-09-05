import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canAccessLaunches, launchWhere } from "@/lib/access";
import { Badge, Card, Empty, PageHeader } from "@/components/ui/fields";
import { LAUNCH_PHASES } from "@/lib/launch-template";
import { LAUNCH_STATUS_LABEL, shortDate } from "@/lib/format";

export default async function LaunchesPage() {
  const user = await requireUser();
  if (!canAccessLaunches(user.role)) redirect("/");
  const projects = await prisma.launchProject.findMany({
    where: launchWhere(user),
    include: { partner: true, store: true, curator: { select: { name: true } }, tasks: true },
    orderBy: [{ status: "asc" }, { startedAt: "desc" }],
  });
  const now = new Date();

  return (
    <div>
      <PageHeader
        eyebrow={`${projects.filter((p) => p.status === "active").length} активных`}
        title="Запуски"
        description="Гантт 60–90 дней по 6 фазам. Шаг закрывает партнёр или куратор — вторая сторона получает уведомление."
      />
      {projects.length === 0 ? (
        <Empty title="Запусков нет" hint="Проект создаётся при подключении партнёра из воронки." />
      ) : (
        <div className="space-y-3">
          {projects.map((p) => {
            const done = p.tasks.filter((t) => t.status === "done").length;
            const overdue = p.tasks.filter(
              (t) => t.status !== "done" && t.status !== "skipped" && new Date(p.startedAt.getTime() + t.dueOffsetDays * 86400000) < now,
            ).length;
            const dayN = Math.floor((now.getTime() - p.startedAt.getTime()) / 86400000);
            return (
              <Link key={p.id} href={`/launches/${p.id}`} className="block">
                <Card className="px-5 py-4 transition-colors hover:bg-accent">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {p.store.city} · {p.partner.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        День {dayN} · куратор {p.curator?.name ?? "—"} · цель открытия {shortDate(p.targetOpenAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {overdue ? <Badge tone="warn">{overdue} просрочено</Badge> : null}
                      <Badge tone={p.status === "opened" ? "success" : "steel"}>{LAUNCH_STATUS_LABEL[p.status]}</Badge>
                      <span className="font-mono text-xs">
                        {done}/{p.tasks.length}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-6 gap-1">
                    {LAUNCH_PHASES.map((phase) => {
                      const ts = p.tasks.filter((t) => t.phase === phase);
                      const d = ts.filter((t) => t.status === "done").length;
                      const pct = ts.length ? (d / ts.length) * 100 : 0;
                      return (
                        <div key={phase}>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">{phase}</p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
