import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isUk, ROLE_LABEL } from "@/lib/access";
import { createPartnerInvite, updatePartner } from "@/actions/partners";
import { createTask } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Card, Field, Input, PageHeader, Select, Stat } from "@/components/ui/fields";
import { CopyButton } from "@/components/copy-button";
import { FORMAT_LABEL, PARTNER_STATUS_LABEL, relativeDays, shortDate, STORE_STATUS_LABEL, TASK_STATUS_LABEL } from "@/lib/format";
import { courseProgress } from "@/lib/learning";

export default async function PartnerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  if (!isUk(user.role) && user.partnerId !== id) redirect("/");

  const [partner, curators, invites] = await Promise.all([
    prisma.partner.findUnique({
      where: { id },
      include: {
        curator: true,
        stores: { include: { staff: true } },
        users: { include: { enrollments: { include: { course: { include: { lessons: true } }, progress: true } } } },
        launchProjects: { include: { tasks: { orderBy: { sortOrder: "asc" } }, store: true } },
        leads: true,
        tasks: { where: { status: { in: ["pending", "in_progress"] } }, include: { assignee: { select: { name: true } } }, orderBy: { dueAt: "asc" } },
      },
    }),
    prisma.user.findMany({ where: { role: { in: ["uk_curator", "founder", "uk_admin"] } }, orderBy: { name: "asc" } }),
    prisma.invite.findMany({ where: { partnerId: id, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!partner) notFound();
  const project = partner.launchProjects.find((l) => l.status === "active") ?? partner.launchProjects[0];
  const done = project?.tasks.filter((t) => t.status === "done").length ?? 0;
  const appUrl = process.env.APP_URL ?? "http://localhost:3100";
  const owner = partner.users.find((u) => u.role === "partner");
  const uk = isUk(user.role);
  const assignable = [...partner.users, ...(uk ? curators : [])];

  return (
    <div>
      <PageHeader
        eyebrow={uk ? "Партнёры" : "Мой профиль партнёра"}
        title={`${partner.city} · ${partner.name}`}
        description={`${partner.company ?? "ИП не указан"} · ${FORMAT_LABEL[partner.format]} · подписан ${shortDate(partner.signedAt)}`}
        actions={
          <>
            <Badge tone={partner.status === "active" ? "success" : "steel"}>{PARTNER_STATUS_LABEL[partner.status]}</Badge>
            {project ? (
              <Button asChild size="sm">
                <Link href={`/launches/${project.id}`}>Открыть запуск</Link>
              </Button>
            ) : null}
          </>
        }
      />

      {sp.invite ? (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 border-foreground px-5 py-4">
          <div>
            <p className="eyebrow">Инвайт-ссылка для партнёра</p>
            <p className="mt-1 break-all font-mono text-xs">
              {appUrl}/join/{sp.invite}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Отправьте партнёру в Telegram или WhatsApp. Действует 14 дней.</p>
          </div>
          <CopyButton text={`${appUrl}/join/${sp.invite}`} label="Скопировать" />
        </Card>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Запуск" value={project ? `${done}/${project.tasks.length}` : "—"} hint={project ? `старт ${shortDate(project.startedAt)}` : "проект не создан"} />
        <Stat label="Точки" value={partner.stores.length} hint={partner.stores.map((s) => STORE_STATUS_LABEL[s.status]).join(", ")} />
        <Stat label="Команда" value={partner.users.length} hint={owner ? "партнёр в системе" : "партнёр ещё не вошёл"} />
        <Stat
          label="Обучение"
          value={owner?.enrollments[0] ? `${courseProgress(owner.enrollments[0]).pct}%` : "—"}
          hint={owner?.enrollments[0]?.course.title}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section>
            <p className="eyebrow mb-2">Команда партнёра</p>
            <Card className="divide-y divide-border">
              {partner.users.length === 0 && invites.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">Никого нет. Создайте инвайт.</p>
              ) : null}
              {partner.users.map((u) => {
                const e = u.enrollments[0];
                return (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={u.name} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{u.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_LABEL[u.role]} · {u.email}
                      </p>
                    </div>
                    {e ? <Badge tone={e.completedAt ? "success" : "steel"}>{courseProgress(e).pct}% обучения</Badge> : null}
                  </div>
                );
              })}
              {invites.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{i.email}</p>
                    <p className="text-xs text-muted-foreground">
                      приглашение · {ROLE_LABEL[i.role]} · до {shortDate(i.expiresAt)}
                    </p>
                  </div>
                  <CopyButton text={`${appUrl}/join/${i.token}`} label="Ссылка" />
                </div>
              ))}
            </Card>
            {uk ? (
              <form action={createPartnerInvite} className="mt-2 flex gap-2">
                <input type="hidden" name="partnerId" value={partner.id} />
                <Input name="email" type="email" placeholder="email партнёра" defaultValue={owner ? "" : partner.email ?? ""} required />
                <Button type="submit" variant="outline">
                  Инвайт партнёру
                </Button>
              </form>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Пригласить сотрудников точки —{" "}
                <Link href="/team" className="underline underline-offset-4">
                  Команда
                </Link>
                .
              </p>
            )}
          </section>

          <section>
            <p className="eyebrow mb-2">Точки</p>
            <Card className="divide-y divide-border">
              {partner.stores.map((s) => (
                <Link key={s.id} href={`/stores/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent">
                  <div>
                    <p className="text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {FORMAT_LABEL[s.format]} · {s.address ?? "адрес не указан"} · {s.staff.length} сотрудников
                    </p>
                  </div>
                  <Badge tone={s.status === "open" ? "success" : "steel"}>{STORE_STATUS_LABEL[s.status]}</Badge>
                </Link>
              ))}
            </Card>
          </section>

          {project ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="eyebrow">Запуск · ближайшие шаги</p>
                <Link href={`/launches/${project.id}`} className="eyebrow underline underline-offset-4">
                  Весь план
                </Link>
              </div>
              <Card className="divide-y divide-border">
                {project.tasks
                  .filter((t) => t.status !== "done" && t.status !== "skipped")
                  .slice(0, 5)
                  .map((t) => {
                    const due = new Date(project.startedAt.getTime() + t.dueOffsetDays * 86400000);
                    return (
                      <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div>
                          <p className="text-sm">{t.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.phase} · {t.ownerRole}
                          </p>
                        </div>
                        <Badge tone={due < new Date() ? "warn" : "default"}>{relativeDays(due)}</Badge>
                      </div>
                    );
                  })}
              </Card>
            </section>
          ) : null}

          <section>
            <p className="eyebrow mb-2">Задачи по партнёру</p>
            <Card className="divide-y divide-border">
              {partner.tasks.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">Открытых задач нет.</p> : null}
              {partner.tasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <p className="text-sm">{t.title}</p>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {t.assignee?.name ?? TASK_STATUS_LABEL[t.status]} {t.dueAt ? `· ${relativeDays(t.dueAt)}` : ""}
                  </span>
                </div>
              ))}
            </Card>
            <form action={createTask} className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
              <input type="hidden" name="partnerId" value={partner.id} />
              <input type="hidden" name="back" value={`/partners/${partner.id}`} />
              <Input name="title" placeholder="Задача партнёру или куратору" required />
              <Select name="assigneeId" defaultValue={owner?.id ?? user.id} className="sm:w-44">
                {assignable.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <Input name="dueAt" type="date" className="sm:w-40" />
              <Button type="submit" variant="outline">
                Поставить
              </Button>
            </form>
          </section>
        </div>

        <Card className="h-fit px-5 py-5">
          <p className="eyebrow mb-3">Реквизиты</p>
          <form action={updatePartner} className="space-y-3">
            <input type="hidden" name="id" value={partner.id} />
            <Field label="Имя">
              <Input name="name" defaultValue={partner.name} />
            </Field>
            <Field label="Юрлицо / ИП">
              <Input name="company" defaultValue={partner.company ?? ""} />
            </Field>
            <Field label="Телефон">
              <Input name="phone" defaultValue={partner.phone ?? ""} />
            </Field>
            <Field label="Email">
              <Input name="email" defaultValue={partner.email ?? ""} />
            </Field>
            <Field label="Telegram chat id" hint="Для уведомлений о шагах запуска">
              <Input name="telegramChat" defaultValue={partner.telegramChat ?? ""} />
            </Field>
            {uk ? (
              <>
                <Field label="Город">
                  <Input name="city" defaultValue={partner.city} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Статус">
                    <Select name="status" defaultValue={partner.status}>
                      {Object.entries(PARTNER_STATUS_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Формат">
                    <Select name="format" defaultValue={partner.format}>
                      {Object.entries(FORMAT_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field label="Куратор">
                  <Select name="curatorUserId" defaultValue={partner.curatorUserId ?? ""}>
                    <option value="">—</option>
                    {curators.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            ) : null}
            <Button type="submit" variant="secondary" className="w-full">
              Сохранить
            </Button>
          </form>
          {partner.leads.length && uk ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Из лида:{" "}
              <Link href={`/pipeline/${partner.leads[0].id}`} className="underline underline-offset-4">
                {partner.leads[0].name}
              </Link>
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
