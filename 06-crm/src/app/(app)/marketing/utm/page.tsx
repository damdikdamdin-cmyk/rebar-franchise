import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createUtmLink, deleteUtmLink } from "@/actions/marketing";
import { Button } from "@/components/ui/button";
import { Card, Field, Input, Select } from "@/components/ui/fields";
import { CopyButton } from "@/components/copy-button";

function buildUrl(l: { baseUrl: string; source: string; medium: string; campaign: string; content: string | null }) {
  const u = new URL(l.baseUrl);
  u.searchParams.set("utm_source", l.source);
  u.searchParams.set("utm_medium", l.medium);
  u.searchParams.set("utm_campaign", l.campaign);
  if (l.content) u.searchParams.set("utm_content", l.content);
  return u.toString();
}

export default async function UtmPage() {
  const [links, campaigns] = await Promise.all([
    prisma.utmLink.findMany({ include: { campaignRef: true }, orderBy: { createdAt: "desc" } }),
    prisma.campaign.findMany({ orderBy: { name: "asc" } }),
  ]);
  const leads = await prisma.lead.groupBy({ by: ["utmSource", "utmMedium", "utmCampaign"], _count: { _all: true }, where: { utmSource: { not: null } } });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Card className="divide-y divide-border">
          {links.map((l) => {
            let url = "";
            try {
              url = buildUrl(l);
            } catch {
              url = l.baseUrl;
            }
            const count = leads.find((x) => x.utmSource === l.source && x.utmMedium === l.medium && x.utmCampaign === l.campaign)?._count._all ?? 0;
            return (
              <div key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{l.name}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">{url}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {l.source} / {l.medium} / {l.campaign}
                    {l.campaignRef ? ` · ${l.campaignRef.name}` : ""} · заявок: {count}
                  </p>
                </div>
                <CopyButton text={url} />
                <form action={deleteUtmLink}>
                  <input type="hidden" name="id" value={l.id} />
                  <Button type="submit" size="xs" variant="ghost">
                    Удалить
                  </Button>
                </form>
              </div>
            );
          })}
        </Card>
        <p className="text-xs text-muted-foreground">
          Схема именования —{" "}
          <Link href="/kb/utm-guide" className="underline underline-offset-4">
            UTM-гайд в базе знаний
          </Link>
          . Лендинг передаёт utm_* в заявку через <code className="font-mono">/api/leads</code>.
        </p>
      </div>
      <Card className="h-fit px-5 py-5">
        <p className="eyebrow mb-3">Новая ссылка</p>
        <form action={createUtmLink} className="space-y-3">
          <Field label="Название">
            <Input name="name" required />
          </Field>
          <Field label="Базовый URL">
            <Input name="baseUrl" defaultValue="https://rebar.pro" required />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="source">
              <Input name="source" defaultValue="telegram" required />
            </Field>
            <Field label="medium">
              <Input name="medium" defaultValue="social" required />
            </Field>
          </div>
          <Field label="campaign">
            <Input name="campaign" defaultValue="franchise" required />
          </Field>
          <Field label="content">
            <Input name="content" />
          </Field>
          <Field label="Кампания в CRM">
            <Select name="campaignId" defaultValue="">
              <option value="">—</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" className="w-full">
            Сгенерировать
          </Button>
        </form>
      </Card>
    </div>
  );
}
