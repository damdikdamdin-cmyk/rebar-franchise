import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canAccessPipeline, isAdmin, UK_ROLES } from "@/lib/access";
import { addLeadActivity, convertLeadToPartner, deleteLead, moveLead, updateLead } from "@/actions/pipeline";
import { createTask } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { Badge, Card, Field, Input, Select, Textarea } from "@/components/ui/fields";
import { dateTime, FORMAT_LABEL, LEAD_STAGES, rub, TASK_STATUS_LABEL } from "@/lib/format";

const ACTIVITY_TYPES: Record<string, string> = {
  note: "Заметка",
  call: "Звонок",
  zoom: "Zoom",
  message: "Сообщение",
  stage: "Стадия",
  edit: "Правка",
  convert: "Подключение",
};

export default async function LeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  if (!canAccessPipeline(user.role)) redirect("/");
  const { id } = await params;
  const sp = await searchParams;
  const [lead, team, curators] = await Promise.all([
    prisma.lead.findUnique({
      where: { id },
      include: {
        owner: true,
        partner: true,
        activities: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
        tasks: { orderBy: { dueAt: "asc" }, include: { assignee: { select: { name: true } } } },
      },
    }),
    prisma.user.findMany({ where: { role: { in: UK_ROLES } }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: { in: ["uk_curator", "founder", "uk_admin"] } }, orderBy: { name: "asc" } }),
  ]);
  if (!lead) notFound();
  const stageIdx = LEAD_STAGES.findIndex((s) => s.id === lead.stage);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-8">
        <div>
          <Link href="/pipeline" className="eyebrow underline underline-offset-4">
            Воронка
          </Link>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="display text-5xl">{lead.name}</h1>
              <p className="mt-2 font-mono text-sm">
                {lead.phone}
                {lead.email ? ` · ${lead.email}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {lead.format ? <Badge>{FORMAT_LABEL[lead.format]}</Badge> : null}
              {lead.budget ? <Badge tone="steel">{rub(lead.budget)}</Badge> : null}
              <Badge tone="ink">{LEAD_STAGES[stageIdx]?.label}</Badge>
            </div>
          </div>
        </div>

        {/* Stage stepper */}
        <div className="flex flex-wrap gap-1">
          {LEAD_STAGES.filter((s) => s.id !== "lost").map((s, i) => (
            <form key={s.id} action={moveLead}>
              <input type="hidden" name="id" value={lead.id} />
              <input type="hidden" name="stage" value={s.id} />
              <button
                type="submit"
                className={`rounded-sm px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                  i <= stageIdx && lead.stage !== "lost" ? "bg-foreground text-background" : "border border-border hover:bg-accent"
                }`}
              >
                {s.label}
              </button>
            </form>
          ))}
          <form action={moveLead}>
            <input type="hidden" name="id" value={lead.id} />
            <input type="hidden" name="stage" value="lost" />
            <button
              type="submit"
              className={`rounded-sm px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${lead.stage === "lost" ? "bg-destructive text-destructive-foreground" : "border border-dashed border-border text-muted-foreground hover:bg-accent"}`}
            >
              Отказ
            </button>
          </form>
        </div>

        {/* Convert */}
        {lead.partner ? (
          <Card className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="eyebrow">Партнёр подключён</p>
              <p className="mt-1 text-sm">
                {lead.partner.city} · {lead.partner.name}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/partners/${lead.partner.id}`}>Открыть карточку партнёра</Link>
            </Button>
          </Card>
        ) : lead.stage === "paid" || lead.stage === "contract" ? (
          <Card className="border-foreground px-5 py-5">
            <p className="eyebrow">Оплата получена → подключить партнёра</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Создадим партнёра, точку в статусе «Запуск», проект запуска на 16 шагов и инвайт-ссылку для входа.
            </p>
            {sp.error ? <p className="mt-2 text-xs text-destructive">Нужны email и город.</p> : null}
            <form action={convertLeadToPartner} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="leadId" value={lead.id} />
              <Field label="Email партнёра (для входа)">
                <Input name="email" type="email" defaultValue={lead.email ?? ""} required />
              </Field>
              <Field label="Город точки">
                <Input name="city" defaultValue={lead.city ?? ""} required />
              </Field>
              <Field label="Формат">
                <Select name="format" defaultValue={lead.format ?? "standard"}>
                  {Object.entries(FORMAT_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Куратор">
                <Select name="curatorUserId" defaultValue="">
                  <option value="">Назначить позже</option>
                  {curators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Юрлицо / ИП">
                <Input name="company" placeholder="ИП Иванов И.И." />
              </Field>
              <div className="flex items-end">
                <Button type="submit" className="w-full">
                  Подключить партнёра
                </Button>
              </div>
            </form>
          </Card>
        ) : null}

        {/* Timeline */}
        <section>
          <p className="eyebrow mb-2">Активности · {lead.activities.length}</p>
          <form action={addLeadActivity} className="mb-3 flex gap-2">
            <input type="hidden" name="leadId" value={lead.id} />
            <Select name="type" defaultValue="note" className="w-32">
              {["note", "call", "zoom", "message"].map((t) => (
                <option key={t} value={t}>
                  {ACTIVITY_TYPES[t]}
                </option>
              ))}
            </Select>
            <Input name="body" placeholder="Что произошло…" required />
            <Button type="submit" variant="secondary">
              Добавить
            </Button>
          </form>
          <ol className="relative space-y-3 border-l border-border pl-5">
            {lead.activities.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[26px] top-1.5 size-2.5 rounded-full border border-border bg-background" />
                <p className="text-sm">{a.body}</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {ACTIVITY_TYPES[a.type] ?? a.type} · {dateTime(a.createdAt)}
                  {a.user ? ` · ${a.user.name}` : ""}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <aside className="space-y-6">
        <Card className="px-5 py-5">
          <p className="eyebrow mb-3">Карточка</p>
          <form action={updateLead} className="space-y-3">
            <input type="hidden" name="id" value={lead.id} />
            <Field label="Имя">
              <Input name="name" defaultValue={lead.name} />
            </Field>
            <Field label="Телефон">
              <Input name="phone" defaultValue={lead.phone} />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={lead.email ?? ""} />
            </Field>
            <Field label="Город">
              <Input name="city" defaultValue={lead.city ?? ""} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Бюджет">
                <Input name="budget" type="number" defaultValue={lead.budget ?? ""} />
              </Field>
              <Field label="Формат">
                <Select name="format" defaultValue={lead.format ?? ""}>
                  <option value="">—</option>
                  {Object.entries(FORMAT_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Владелец">
              <Select name="ownerUserId" defaultValue={lead.ownerUserId ?? ""}>
                <option value="">—</option>
                {team.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Следующий шаг">
              <Input name="nextStepAt" type="datetime-local" defaultValue={lead.nextStepAt ? toLocalInput(lead.nextStepAt) : ""} />
            </Field>
            <Field label="Заметка">
              <Textarea name="note" defaultValue={lead.note ?? ""} className="min-h-20" />
            </Field>
            <p className="font-mono text-[10px] text-muted-foreground">
              Источник: {lead.source}
              {lead.utmSource ? ` · utm ${lead.utmSource}/${lead.utmMedium ?? ""}/${lead.utmCampaign ?? ""}` : ""}
            </p>
            <Button type="submit" variant="secondary" className="w-full">
              Сохранить
            </Button>
          </form>
        </Card>

        <Card className="px-5 py-5">
          <p className="eyebrow mb-3">Задачи по лиду</p>
          <ul className="mb-3 space-y-1 text-sm">
            {lead.tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <span className={t.status === "done" ? "text-muted-foreground line-through" : ""}>{t.title}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{t.assignee?.name ?? TASK_STATUS_LABEL[t.status]}</span>
              </li>
            ))}
          </ul>
          <form action={createTask} className="space-y-2">
            <input type="hidden" name="leadId" value={lead.id} />
            <input type="hidden" name="back" value={`/pipeline/${lead.id}`} />
            <Input name="title" placeholder="Новая задача" required />
            <div className="grid grid-cols-2 gap-2">
              <Select name="assigneeId" defaultValue={user.id}>
                {team.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <Input name="dueAt" type="date" />
            </div>
            <Button type="submit" size="sm" variant="outline" className="w-full">
              Поставить задачу
            </Button>
          </form>
        </Card>

        {isAdmin(user.role) ? (
          <form action={deleteLead}>
            <input type="hidden" name="id" value={lead.id} />
            <Button type="submit" variant="ghost" size="sm" className="text-destructive">
              Удалить лид
            </Button>
          </form>
        ) : null}
      </aside>
    </div>
  );
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
