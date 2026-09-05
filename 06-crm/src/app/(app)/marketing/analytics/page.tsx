import { prisma } from "@/lib/prisma";
import { Card, Stat } from "@/components/ui/fields";
import { LeadsChart } from "@/components/marketing/leads-chart";
import { LEAD_STAGE_LABEL } from "@/lib/format";

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
  const leads = await prisma.lead.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, source: true, stage: true, utmSource: true } });
  return { leads, weeks: emptyWeeks(now) };
}

export default async function AnalyticsPage() {
  const { leads, weeks } = await loadAnalytics();
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

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Заявок за 8 недель" value={leads.length} />
        <Stat label="Квалифицировано" value={leads.filter((l) => !["new", "contacted", "lost"].includes(l.stage)).length} />
        <Stat label="Оплат" value={paid} />
        <Stat label="Конверсия в оплату" value={leads.length ? `${Math.round((paid / leads.length) * 100)}%` : "—"} />
      </div>
      <Card className="px-5 py-5">
        <p className="eyebrow mb-3">Заявки по неделям</p>
        <LeadsChart data={Object.values(weeks)} />
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="px-5 py-5">
          <p className="eyebrow mb-3">По источникам</p>
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
    </div>
  );
}

function weekKey(d: Date) {
  const r = new Date(d);
  const day = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - day);
  return `${String(r.getDate()).padStart(2, "0")}.${String(r.getMonth() + 1).padStart(2, "0")}`;
}
