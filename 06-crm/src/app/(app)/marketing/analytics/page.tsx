import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, Stat } from "@/components/ui/fields";
import { LeadsChart } from "@/components/marketing/leads-chart";
import { LEAD_STAGE_LABEL, rub } from "@/lib/format";

function emptyWeeks(now: number) {
  const weeks: Record<string, { week: string; leads: number; qualified: number }> = {};
  for (let i = 7; i >= 0; i--) {
    const key = weekKey(new Date(now - i * 7 * 86400000));
    weeks[key] = { week: key, leads: 0, qualified: 0 };
  }
  return weeks;
}

async function loadAnalytics() {
  const now = Date.now();
  const since = new Date(now - 56 * 86400000);
  const [leads, sales] = await Promise.all([
    prisma.lead.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, source: true, stage: true, utmSource: true },
    }),
    prisma.sale.findMany({
      where: { soldAt: { gte: since } },
      select: { amount: true, creditAmount: true, soldAt: true, storeId: true, store: { select: { city: true, name: true } } },
    }),
  ]);
  return { leads, sales, weeks: emptyWeeks(now) };
}

export default async function AnalyticsPage() {
  const { leads, sales, weeks } = await loadAnalytics();
  for (const l of leads) {
    const k = weekKey(l.createdAt);
    if (!weeks[k]) continue;
    weeks[k].leads++;
    if (!["new", "contacted", "lost"].includes(l.stage)) weeks[k].qualified++;
  }
  const bySource = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => {
      const k = l.utmSource ?? l.source;
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const byStage = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => {
      acc[l.stage] = (acc[l.stage] ?? 0) + 1;
      return acc;
    }, {}),
  );
  const paid = leads.filter((l) => l.stage === "paid").length;
  const retailRevenue = sales.reduce((s, x) => s + x.amount, 0);
  const lendo = sales.reduce((s, x) => s + x.creditAmount, 0);
  const byStore = Object.entries(
    sales.reduce<Record<string, { label: string; amount: number }>>((acc, s) => {
      const key = s.storeId;
      const label = `${s.store.city} · ${s.store.name}`;
      acc[key] = acc[key] ?? { label, amount: 0 };
      acc[key].amount += s.amount;
      return acc;
    }, {}),
  )
    .map(([, v]) => v)
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Заявок за 8 недель" value={leads.length} />
        <Stat label="Квалифицировано" value={leads.filter((l) => !["new", "contacted", "lost"].includes(l.stage)).length} />
        <Stat label="Оплат франшизы" value={paid} />
        <Stat label="Конверсия в оплату" value={leads.length ? `${Math.round((paid / leads.length) * 100)}%` : "—"} />
        <Stat label="Выручка розницы · 8 нед" value={rub(retailRevenue)} hint={`${sales.length} чеков`} />
        <Stat label="Lendo в рознице" value={rub(lendo)} hint={retailRevenue ? `${Math.round((lendo / retailRevenue) * 100)}%` : undefined} />
      </div>

      <Card className="px-5 py-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="eyebrow">Заявки по неделям</p>
          <Link href="/network" className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground underline">
            Сводка сети →
          </Link>
        </div>
        <LeadsChart data={Object.values(weeks)} />
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="px-5 py-5">
          <p className="eyebrow mb-3">По источникам заявок</p>
          <ul className="space-y-2">
            {bySource.map(([s, n]) => (
              <li key={s} className="flex items-center gap-3 text-sm">
                <span className="w-28 truncate">{s}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-foreground" style={{ width: `${(n / Math.max(1, leads.length)) * 100}%` }} />
                </div>
                <span className="w-6 text-right font-mono text-xs">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="px-5 py-5">
          <p className="eyebrow mb-3">По стадиям</p>
          <ul className="space-y-2">
            {byStage.map(([s, n]) => (
              <li key={s} className="flex items-center gap-3 text-sm">
                <span className="w-28 truncate">{LEAD_STAGE_LABEL[s as keyof typeof LEAD_STAGE_LABEL]}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-foreground" style={{ width: `${(n / Math.max(1, leads.length)) * 100}%` }} />
                </div>
                <span className="w-6 text-right font-mono text-xs">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {byStore.length > 0 ? (
        <Card className="px-5 py-5">
          <p className="eyebrow mb-3">Розница по точкам · 8 недель</p>
          <ul className="space-y-2">
            {byStore.map((s) => (
              <li key={s.label} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-foreground"
                    style={{ width: `${(s.amount / Math.max(1, retailRevenue)) * 100}%` }}
                  />
                </div>
                <span className="w-24 text-right font-mono text-xs">{rub(s.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function weekKey(d: Date) {
  const r = new Date(d);
  const day = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - day);
  return `${String(r.getDate()).padStart(2, "0")}.${String(r.getMonth() + 1).padStart(2, "0")}`;
}
