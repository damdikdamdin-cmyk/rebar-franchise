import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isUk } from "@/lib/access";
import { LAUNCH_STATUS_LABEL, TASK_STATUS_LABEL, shortDate } from "@/lib/format";
import { updateLaunchTask } from "@/actions/ops";
import { Badge } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";

const STATUSES: TaskStatus[] = ["pending", "in_progress", "done", "skipped"];

export default async function LaunchPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!isUk(user.role) && user.partnerId !== id) redirect("/");

  const partner = await prisma.partner.findUnique({
    where: { id },
    include: {
      launchProjects: {
        include: { store: true, tasks: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!partner) notFound();
  const project = partner.launchProjects[0];
  if (!project) notFound();

  const done = project.tasks.filter((t) => t.status === "done").length;
  const phases = [...new Set(project.tasks.map((t) => t.phase))];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href={`/partners/${partner.id}`} className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          ← {partner.name}
        </Link>
        <h1 className="mt-2 font-serif text-4xl italic">Запуск {project.store.city}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {LAUNCH_STATUS_LABEL[project.status]} · {done}/{project.tasks.length} шагов
          {project.targetOpenAt ? ` · план ${shortDate(project.targetOpenAt)}` : ""}
        </p>
        <div className="mt-3 h-1 bg-secondary">
          <div className="h-1 bg-foreground" style={{ width: `${project.tasks.length ? (done / project.tasks.length) * 100 : 0}%` }} />
        </div>
      </div>

      {phases.map((phase) => (
        <section key={phase}>
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{phase}</h2>
          <ul className="space-y-2">
            {project.tasks
              .filter((task) => task.phase === phase)
              .map((task) => (
                <li key={task.id} className="border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        {task.ownerRole} · день {task.dueOffsetDays}
                      </p>
                    </div>
                    <Badge tone={task.status === "done" ? "open" : "steel"}>{TASK_STATUS_LABEL[task.status]}</Badge>
                  </div>
                  <form action={updateLaunchTask} className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="taskId" value={task.id} />
                    <select
                      name="status"
                      defaultValue={task.status}
                      className="h-8 border border-input bg-background px-2 font-mono text-[11px] uppercase tracking-[0.1em]"
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {TASK_STATUS_LABEL[status]}
                        </option>
                      ))}
                    </select>
                    <input
                      name="comment"
                      defaultValue={task.comment ?? ""}
                      placeholder="Комментарий"
                      className="h-8 min-w-40 flex-1 border border-input bg-background px-2 text-sm"
                    />
                    <Button type="submit" size="sm" variant="outline">
                      Сохранить
                    </Button>
                  </form>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
