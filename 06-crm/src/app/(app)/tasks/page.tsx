import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isUk } from "@/lib/access";
import { createTask, setTaskStatus } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { Badge, Card, Empty, Field, Input, PageHeader, Select } from "@/components/ui/fields";
import { relativeDays, shortDate, TASK_STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ scope?: string; focus?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope = sp.scope ?? "mine";
  const now = new Date();

  const where =
    scope === "all" && isUk(user.role)
      ? {}
      : scope === "created"
        ? { createdById: user.id }
        : scope === "partner" && user.partnerId
          ? { partnerId: user.partnerId }
          : { assigneeId: user.id };

  const [tasks, people] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { assignee: { select: { name: true } }, createdBy: { select: { name: true } }, lead: true, partner: true, store: true },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    }),
    prisma.user.findMany({
      where: isUk(user.role) ? {} : { OR: [{ partnerId: user.partnerId ?? "__none__" }, { id: user.id }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const open = tasks.filter((t) => t.status !== "done" && t.status !== "skipped");
  const closed = tasks.filter((t) => t.status === "done" || t.status === "skipped");

  const scopes = [
    { id: "mine", label: "Мои" },
    { id: "created", label: "Поставил я" },
    ...(user.partnerId ? [{ id: "partner", label: "Команда" }] : []),
    ...(isUk(user.role) ? [{ id: "all", label: "Все" }] : []),
  ];

  return (
    <div>
      <PageHeader
        eyebrow={`${open.length} открытых`}
        title="Задачи"
        actions={scopes.map((s) => (
          <Button key={s.id} asChild size="sm" variant={scope === s.id ? "secondary" : "outline"}>
            <Link href={`/tasks?scope=${s.id}`}>{s.label}</Link>
          </Button>
        ))}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {open.length === 0 ? (
            <Empty title="Открытых задач нет" />
          ) : (
            <Card className="divide-y divide-border">
              {open.map((t) => (
                <TaskRow key={t.id} t={t} now={now} focus={sp.focus === t.id} />
              ))}
            </Card>
          )}
          {closed.length ? (
            <details>
              <summary className="eyebrow cursor-pointer">Закрытые · {closed.length}</summary>
              <Card className="mt-2 divide-y divide-border opacity-70">
                {closed.map((t) => (
                  <TaskRow key={t.id} t={t} now={now} focus={false} />
                ))}
              </Card>
            </details>
          ) : null}
        </div>

        <Card className="h-fit px-5 py-5">
          <p className="eyebrow mb-3">Новая задача</p>
          <form action={createTask} className="space-y-3">
            <Field label="Что сделать">
              <Input name="title" required />
            </Field>
            <Field label="Исполнитель">
              <Select name="assigneeId" defaultValue={user.id}>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Срок">
              <Input name="dueAt" type="date" />
            </Field>
            <Field label="Детали">
              <Input name="body" />
            </Field>
            <Button type="submit" className="w-full">
              Поставить
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function TaskRow({
  t,
  now,
  focus,
}: {
  t: {
    id: string;
    title: string;
    body: string | null;
    status: "pending" | "in_progress" | "done" | "skipped";
    dueAt: Date | null;
    assignee: { name: string } | null;
    createdBy: { name: string } | null;
    lead: { id: string; name: string } | null;
    partner: { id: string; name: string; city: string } | null;
    store: { id: string; name: string } | null;
  };
  now: Date;
  focus: boolean;
}) {
  const overdue = t.dueAt && t.dueAt < now && t.status !== "done";
  return (
    <div id={t.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", focus && "bg-accent")}>
      <form action={setTaskStatus}>
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
        <p className={cn("text-sm", t.status === "done" && "line-through")}>{t.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {t.assignee?.name ?? "—"}
          {t.createdBy ? ` · от ${t.createdBy.name}` : ""}
          {t.lead ? (
            <>
              {" · "}
              <Link href={`/pipeline/${t.lead.id}`} className="underline underline-offset-2">
                лид {t.lead.name}
              </Link>
            </>
          ) : null}
          {t.partner ? (
            <>
              {" · "}
              <Link href={`/partners/${t.partner.id}`} className="underline underline-offset-2">
                {t.partner.city}
              </Link>
            </>
          ) : null}
          {t.body ? ` · ${t.body}` : ""}
        </p>
      </div>
      {t.status === "in_progress" ? <Badge tone="steel">{TASK_STATUS_LABEL.in_progress}</Badge> : null}
      {t.dueAt ? (
        <Badge tone={overdue ? "warn" : "default"} title={shortDate(t.dueAt)}>
          {relativeDays(t.dueAt)}
        </Badge>
      ) : null}
      {t.status !== "done" ? (
        <form action={setTaskStatus}>
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="status" value={t.status === "in_progress" ? "pending" : "in_progress"} />
          <Button type="submit" size="xs" variant="ghost">
            {t.status === "in_progress" ? "Пауза" : "В работу"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
