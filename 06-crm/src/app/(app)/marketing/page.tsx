import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createContentItem, deleteContentItem, setContentStatus } from "@/actions/marketing";
import { Button } from "@/components/ui/button";
import { Badge, Card, Field, Input, Select, Textarea } from "@/components/ui/fields";
import { CHANNELS, CONTENT_STATUS_LABEL, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function startOfWeek(d: Date) {
  const r = new Date(d);
  const day = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - day);
  r.setHours(0, 0, 0, 0);
  return r;
}

export default async function MarketingCalendar({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const sp = await searchParams;
  const offset = Number(sp.w ?? 0);
  const start = startOfWeek(new Date());
  start.setDate(start.getDate() + offset * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);

  const [items, campaigns] = await Promise.all([
    prisma.contentItem.findMany({ where: { publishAt: { gte: start, lt: end } }, include: { campaign: true }, orderBy: { publishAt: "asc" } }),
    prisma.campaign.findMany({ where: { status: { not: "finished" } }, orderBy: { name: "asc" } }),
  ]);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
  const today = new Date().toDateString();

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="eyebrow">
            {shortDate(start)} — {shortDate(new Date(end.getTime() - 86400000))} · {items.length} публикаций
          </p>
          <div className="flex gap-1">
            <Button asChild size="xs" variant="outline">
              <Link href={`/marketing?w=${offset - 1}`}>←</Link>
            </Button>
            <Button asChild size="xs" variant="outline">
              <Link href="/marketing">Сегодня</Link>
            </Button>
            <Button asChild size="xs" variant="outline">
              <Link href={`/marketing?w=${offset + 1}`}>→</Link>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const dayItems = items.filter((i) => i.publishAt.toDateString() === d.toDateString());
            return (
              <div key={d.toISOString()} className={cn("min-h-28 rounded-md border border-border bg-card p-1.5", d.toDateString() === today && "border-foreground")}>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {d.toLocaleDateString("ru-RU", { weekday: "short" })} {d.getDate()}
                </p>
                <div className="mt-1 space-y-1">
                  {dayItems.map((i) => (
                    <details key={i.id} className="group">
                      <summary
                        className={cn(
                          "cursor-pointer list-none rounded-sm px-1.5 py-1 text-[11px] leading-tight",
                          i.status === "published" ? "bg-foreground text-background" : i.status === "scheduled" ? "bg-secondary" : "bg-muted",
                        )}
                      >
                        <span className="block truncate">{i.title}</span>
                        <span className="font-mono text-[9px] opacity-70">{i.channel}</span>
                      </summary>
                      <div className="mt-1 space-y-1 rounded-sm border border-border bg-popover p-2 text-xs">
                        {i.rubric ? <Badge>{i.rubric}</Badge> : null}
                        {i.campaign ? <p className="text-muted-foreground">{i.campaign.name}</p> : null}
                        {i.body ? <p>{i.body}</p> : null}
                        <form action={setContentStatus} className="flex gap-1">
                          <input type="hidden" name="id" value={i.id} />
                          <select name="status" defaultValue={i.status} className="h-6 flex-1 rounded-sm border border-border bg-transparent font-mono text-[10px]">
                            {Object.entries(CONTENT_STATUS_LABEL).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="rounded-sm border border-border px-1 font-mono text-[10px]">
                            ок
                          </button>
                        </form>
                        <form action={deleteContentItem}>
                          <input type="hidden" name="id" value={i.id} />
                          <button type="submit" className="font-mono text-[10px] text-destructive">
                            удалить
                          </button>
                        </form>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Card className="h-fit px-5 py-5">
        <p className="eyebrow mb-3">Новая публикация</p>
        <form action={createContentItem} className="space-y-3">
          <Field label="Заголовок">
            <Input name="title" required />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Канал">
              <Select name="channel" defaultValue="Telegram">
                {CHANNELS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Дата">
              <Input name="publishAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Рубрика">
              <Input name="rubric" placeholder="Продукт / Кейсы / Цифры" />
            </Field>
            <Field label="Статус">
              <Select name="status" defaultValue="idea">
                {Object.entries(CONTENT_STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Кампания">
            <Select name="campaignId" defaultValue="">
              <option value="">—</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Текст / тезисы">
            <Textarea name="body" className="min-h-20" />
          </Field>
          <Button type="submit" className="w-full">
            В календарь
          </Button>
        </form>
        <p className="mt-4 text-xs text-muted-foreground">
          Рубрики и тон —{" "}
          <Link href="/kb/rubrics" className="underline underline-offset-4">
            в базе знаний
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
