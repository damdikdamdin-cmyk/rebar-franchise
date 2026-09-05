import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canAccessPipeline } from "@/lib/access";
import { Badge, Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { FORMAT_LABEL, LEAD_STAGES, relativeDays, rub } from "@/lib/format";
import { createLead, moveLead } from "@/actions/pipeline";
import { cn } from "@/lib/utils";

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ view?: string; new?: string }> }) {
  const user = await requireUser();
  if (!canAccessPipeline(user.role)) redirect("/");
  const sp = await searchParams;
  const leads = await prisma.lead.findMany({
    orderBy: { updatedAt: "desc" },
    include: { owner: { select: { name: true } }, _count: { select: { activities: true } } },
  });
  const now = new Date();
  const active = leads.filter((l) => l.stage !== "lost");
  const budget = active.reduce((s, l) => s + (l.budget ?? 0), 0);

  return (
    <div>
      <PageHeader
        eyebrow={`${active.length} активных · ${leads.filter((l) => l.stage === "paid").length} оплат`}
        title="Воронка"
        description={budget ? `Бюджет активных сделок: ${rub(budget)}` : undefined}
        actions={
          <>
            <Button asChild variant={sp.view === "list" ? "outline" : "secondary"} size="sm">
              <Link href="/pipeline">Канбан</Link>
            </Button>
            <Button asChild variant={sp.view === "list" ? "secondary" : "outline"} size="sm">
              <Link href="/pipeline?view=list">Список</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/pipeline?new=1">Новый лид</Link>
            </Button>
          </>
        }
      />

      {sp.new ? (
        <Card className="mb-6 px-5 py-5">
          <p className="eyebrow mb-3">Новый лид</p>
          <form action={createLead} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Имя">
              <Input name="name" required />
            </Field>
            <Field label="Телефон">
              <Input name="phone" required />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" />
            </Field>
            <Field label="Город">
              <Input name="city" />
            </Field>
            <Field label="Источник">
              <Select name="source" defaultValue="manual">
                <option value="manual">Вручную</option>
                <option value="landing">Лендинг</option>
                <option value="instagram">Instagram</option>
                <option value="telegram">Telegram</option>
                <option value="referral">Рекомендация</option>
                <option value="avito">Avito</option>
                <option value="yandex">Яндекс</option>
              </Select>
            </Field>
            <Field label="Формат">
              <Select name="format" defaultValue="">
                <option value="">—</option>
                {Object.entries(FORMAT_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Бюджет, ₽">
              <Input name="budget" type="number" />
            </Field>
            <div className="sm:col-span-2 lg:col-span-4">
              <Field label="Заметка">
                <Textarea name="note" className="min-h-16" />
              </Field>
            </div>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit">Создать</Button>
              <Button asChild variant="ghost">
                <Link href="/pipeline">Отмена</Link>
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {sp.view === "list" ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left [&>th]:eyebrow [&>th]:px-4 [&>th]:py-2">
                <th>Лид</th>
                <th>Город</th>
                <th>Стадия</th>
                <th>Источник</th>
                <th>Бюджет</th>
                <th>Владелец</th>
                <th>След. шаг</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0 hover:bg-accent">
                  <td className="px-4 py-2">
                    <Link href={`/pipeline/${l.id}`} className="font-medium">
                      {l.name}
                    </Link>
                    <p className="font-mono text-[10px] text-muted-foreground">{l.phone}</p>
                  </td>
                  <td className="px-4 py-2">{l.city ?? "—"}</td>
                  <td className="px-4 py-2">
                    <Badge tone={l.stage === "paid" ? "success" : l.stage === "lost" ? "default" : "steel"}>
                      {LEAD_STAGES.find((s) => s.id === l.stage)?.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{l.source}</td>
                  <td className="px-4 py-2 font-mono tabular-nums">{l.budget ? rub(l.budget) : "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{l.owner?.name ?? "—"}</td>
                  <td className={cn("px-4 py-2 font-mono text-xs", l.nextStepAt && l.nextStepAt < now && "text-destructive")}>
                    {l.nextStepAt ? relativeDays(l.nextStepAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
          <div className="grid min-w-[1400px] grid-cols-8 gap-3">
            {LEAD_STAGES.map((stage) => {
              const col = leads.filter((l) => l.stage === stage.id);
              return (
                <div key={stage.id} className="flex flex-col">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <p className="eyebrow">{stage.label}</p>
                    <span className="font-mono text-[10px] text-muted-foreground">{col.length}</span>
                  </div>
                  <div className="flex-1 space-y-2 rounded-lg bg-muted/50 p-2">
                    {col.map((l) => (
                      <div key={l.id} className="rounded-md border border-border bg-card p-3 shadow-sm">
                        <Link href={`/pipeline/${l.id}`} className="block">
                          <p className="text-sm font-medium leading-tight">{l.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{l.city ?? "город?"}</p>
                        </Link>
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          {l.budget ? <span className="font-mono text-[10px]">{rub(l.budget)}</span> : null}
                          {l.format ? <Badge>{FORMAT_LABEL[l.format]}</Badge> : null}
                          {l.nextStepAt ? (
                            <Badge tone={l.nextStepAt < now ? "warn" : "steel"}>{relativeDays(l.nextStepAt)}</Badge>
                          ) : null}
                        </div>
                        <form action={moveLead} className="mt-2 flex gap-1">
                          <input type="hidden" name="id" value={l.id} />
                          <select
                            name="stage"
                            defaultValue={l.stage}
                            className="h-6 flex-1 rounded-sm border border-border bg-transparent px-1 font-mono text-[10px]"
                          >
                            {LEAD_STAGES.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="rounded-sm border border-border px-1.5 font-mono text-[10px] hover:bg-accent">
                            →
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
