import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isUk } from "@/lib/access";
import { setLaunchDates, setLaunchTaskStatus } from "@/actions/partners";
import { Button } from "@/components/ui/button";
import { Badge, Card, Field, Input, PageHeader, Stat } from "@/components/ui/fields";
import { LAUNCH_PHASES } from "@/lib/launch-template";
import { LAUNCH_STATUS_LABEL, relativeDays, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function LaunchPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await prisma.launchProject.findUnique({
    where: { id },
    include: { partner: true, store: true, curator: true, tasks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!project) notFound();
  const uk = isUk(user.role);
  if (!uk && user.partnerId !== project.partnerId) redirect("/");
  if (user.role === "uk_curator" && project.curatorUserId && project.curatorUserId !== user.id && !["founder", "uk_admin"].includes(user.role)) {
    // куратор видит чужие запуски только для чтения — оставляем доступ
  }

  const now = new Date();
  const done = project.tasks.filter((t) => t.status === "done").length;
  const dayN = Math.floor((now.getTime() - project.startedAt.getTime()) / 86400000);
  const totalDays = 90;
  const articles = await prisma.kbArticle.findMany({
    where: { slug: { in: project.tasks.map((t) => t.articleSlug).filter((s): s is string => !!s) } },
    select: { slug: true, title: true },
  });
  const articleBySlug = new Map(articles.map((a) => [a.slug, a]));

  return (
    <div>
      <PageHeader
        eyebrow={
          uk ? "Запуски" : "Мой запуск"
        }
        title={`${project.store.city} · ${project.partner.name}`}
        description={`День ${dayN} из ~${totalDays} · куратор ${project.curator?.name ?? "не назначен"}`}
        actions={
          <>
            <Badge tone={project.status === "opened" ? "success" : "steel"}>{LAUNCH_STATUS_LABEL[project.status]}</Badge>
            <Button asChild size="sm" variant="outline">
              <Link href={`/partners/${project.partnerId}`}>Партнёр</Link>
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Прогресс" value={`${done}/${project.tasks.length}`} />
        <Stat label="Старт" value={shortDate(project.startedAt)} />
        <Stat label="Цель открытия" value={shortDate(project.targetOpenAt)} hint={project.targetOpenAt ? relativeDays(project.targetOpenAt) : undefined} />
        <Stat
          label="Просрочено"
          value={
            project.tasks.filter(
              (t) => t.status !== "done" && t.status !== "skipped" && new Date(project.startedAt.getTime() + t.dueOffsetDays * 86400000) < now,
            ).length
          }
        />
      </div>

      {/* Gantt */}
      <Card className="mb-6 overflow-x-auto px-5 py-4">
        <p className="eyebrow mb-3">Гантт</p>
        <div className="relative min-w-[720px]">
          <div
            className="absolute inset-y-0 w-px bg-destructive"
            style={{ left: `${Math.min(100, Math.max(0, (dayN / totalDays) * 100))}%` }}
            title={`Сегодня, день ${dayN}`}
          />
          {project.tasks.map((t) => {
            const start = Math.max(0, t.dueOffsetDays - 7);
            const width = Math.max(3, ((t.dueOffsetDays - start) / totalDays) * 100);
            return (
              <div key={t.id} className="flex items-center gap-3 py-0.5">
                <span className="w-44 shrink-0 truncate text-xs">{t.title}</span>
                <div className="relative h-4 flex-1">
                  <div
                    className={cn(
                      "absolute h-full rounded-sm",
                      t.status === "done" ? "bg-foreground" : t.status === "in_progress" ? "bg-chart-2" : "bg-muted",
                    )}
                    style={{ left: `${(start / totalDays) * 100}%`, width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
          <div className="mt-2 flex justify-between font-mono text-[9px] text-muted-foreground">
            <span>D0</span>
            <span>D30</span>
            <span>D60</span>
            <span>D90</span>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          {LAUNCH_PHASES.map((phase) => {
            const tasks = project.tasks.filter((t) => t.phase === phase);
            if (!tasks.length) return null;
            return (
              <section key={phase}>
                <p className="eyebrow mb-2">
                  {phase} · {tasks.filter((t) => t.status === "done").length}/{tasks.length}
                </p>
                <Card className="divide-y divide-border">
                  {tasks.map((t) => {
                    const due = new Date(project.startedAt.getTime() + t.dueOffsetDays * 86400000);
                    const overdue = due < now && t.status !== "done" && t.status !== "skipped";
                    const article = t.articleSlug ? articleBySlug.get(t.articleSlug) : null;
                    return (
                      <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <form action={setLaunchTaskStatus}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="status" value={t.status === "done" ? "pending" : "done"} />
                          <button
                            type="submit"
                            aria-label="Готово"
                            className={cn(
                              "flex size-5 items-center justify-center rounded-sm border border-border",
                              t.status === "done" && "bg-foreground text-background",
                            )}
                          >
                            {t.status === "done" ? "✓" : ""}
                          </button>
                        </form>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.ownerRole} · срок D+{t.dueOffsetDays} ({shortDate(due)})
                            {article ? (
                              <>
                                {" · "}
                                <Link href={`/kb/${article.slug}`} className="underline underline-offset-2">
                                  {article.title}
                                </Link>
                              </>
                            ) : null}
                            {t.comment ? ` · ${t.comment}` : ""}
                          </p>
                        </div>
                        {t.status === "done" ? (
                          <Badge tone="success">{shortDate(t.completedAt)}</Badge>
                        ) : overdue ? (
                          <Badge tone="warn">{relativeDays(due)}</Badge>
                        ) : (
                          <Badge>{relativeDays(due)}</Badge>
                        )}
                        {t.status !== "done" ? (
                          <form action={setLaunchTaskStatus} className="flex gap-1">
                            <input type="hidden" name="id" value={t.id} />
                            <input type="hidden" name="status" value={t.status === "in_progress" ? "pending" : "in_progress"} />
                            <Button type="submit" size="xs" variant="ghost">
                              {t.status === "in_progress" ? "Пауза" : "В работу"}
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    );
                  })}
                </Card>
              </section>
            );
          })}
        </div>

        <aside className="space-y-4">
          {uk ? (
            <Card className="px-5 py-5">
              <p className="eyebrow mb-3">Даты</p>
              <form action={setLaunchDates} className="space-y-3">
                <input type="hidden" name="id" value={project.id} />
                <Field label="Старт">
                  <Input name="startedAt" type="date" defaultValue={project.startedAt.toISOString().slice(0, 10)} />
                </Field>
                <Field label="Цель открытия">
                  <Input name="targetOpenAt" type="date" defaultValue={project.targetOpenAt?.toISOString().slice(0, 10) ?? ""} />
                </Field>
                <Button type="submit" variant="secondary" className="w-full">
                  Сохранить
                </Button>
              </form>
            </Card>
          ) : null}
          <Card className="px-5 py-5">
            <p className="eyebrow mb-2">Материалы</p>
            <ul className="space-y-1 text-sm">
              <li>
                <Link href="/kb/zapusk-metodichka" className="underline underline-offset-4">
                  Методичка запуска
                </Link>
              </li>
              <li>
                <Link href="/kb/partner-opening-kit" className="underline underline-offset-4">
                  Пакет открытия
                </Link>
              </li>
              <li>
                <Link href="/kb/space/legal" className="underline underline-offset-4">
                  Юрпакет
                </Link>
              </li>
              <li>
                <Link href="/learn/partner-launch" className="underline underline-offset-4">
                  Курс «Запуск партнёра»
                </Link>
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
