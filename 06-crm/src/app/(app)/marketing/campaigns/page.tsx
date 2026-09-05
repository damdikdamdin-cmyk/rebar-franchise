import { prisma } from "@/lib/prisma";
import { createCampaign, setCampaignStatus } from "@/actions/marketing";
import { Button } from "@/components/ui/button";
import { Badge, Card, Field, Input, Select } from "@/components/ui/fields";
import { CAMPAIGN_STATUS_LABEL, rub, shortDate } from "@/lib/format";

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    include: { _count: { select: { contentItems: true, utmLinks: true } } },
    orderBy: [{ status: "asc" }, { startsAt: "desc" }],
  });
  const leadsByCampaign = await prisma.lead.groupBy({ by: ["utmCampaign"], _count: { _all: true }, where: { utmCampaign: { not: null } } });
  const leadCount = new Map(leadsByCampaign.map((l) => [l.utmCampaign, l._count._all]));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="divide-y divide-border">
        {campaigns.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">
                {c.goal ?? "цель не задана"} · {c.channel ?? "—"} · {shortDate(c.startsAt)} — {shortDate(c.endsAt)}
              </p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {c._count.contentItems} публикаций · {c._count.utmLinks} UTM · заявок по utm: {leadCount.get(c.name) ?? 0}
              </p>
            </div>
            {c.budget ? <span className="font-mono text-sm tabular-nums">{rub(c.budget)}</span> : null}
            <form action={setCampaignStatus} className="flex items-center gap-1">
              <input type="hidden" name="id" value={c.id} />
              <Select name="status" defaultValue={c.status} className="h-7 w-32 text-xs">
                {Object.entries(CAMPAIGN_STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
              <Button type="submit" size="xs" variant="outline">
                ок
              </Button>
            </form>
            <Badge tone={c.status === "active" ? "success" : "steel"}>{CAMPAIGN_STATUS_LABEL[c.status]}</Badge>
          </div>
        ))}
      </Card>
      <Card className="h-fit px-5 py-5">
        <p className="eyebrow mb-3">Новая кампания</p>
        <form action={createCampaign} className="space-y-3">
          <Field label="Название">
            <Input name="name" required />
          </Field>
          <Field label="Цель">
            <Input name="goal" placeholder="12 квалифицированных заявок" />
          </Field>
          <Field label="Каналы">
            <Input name="channel" placeholder="Директ + Telegram" />
          </Field>
          <Field label="Бюджет, ₽">
            <Input name="budget" type="number" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Старт">
              <Input name="startsAt" type="date" />
            </Field>
            <Field label="Финиш">
              <Input name="endsAt" type="date" />
            </Field>
          </div>
          <Button type="submit" className="w-full">
            Создать
          </Button>
        </form>
      </Card>
    </div>
  );
}
