import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canAccessPipeline } from "@/lib/access";
import { LEAD_STAGES, shortDate } from "@/lib/format";

export default async function PipelinePage() {
  const user = await requireUser();
  if (!canAccessPipeline(user.role)) redirect("/");

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    include: { owner: true, partner: true },
  });

  const byStage = LEAD_STAGES.map((stage) => ({
    ...stage,
    items: leads.filter((lead) => lead.stage === stage.id),
  }));

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Продажа франшизы</p>
        <h1 className="mt-1 font-serif text-4xl">Воронка УК</h1>
      </header>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {byStage.map((col) => (
          <section key={col.id} className="w-64 shrink-0 border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-3 py-2">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.14em]">{col.label}</h2>
              <span className="font-mono text-xs text-muted-foreground">{col.items.length}</span>
            </header>
            <ul className="space-y-2 p-2">
              {col.items.map((lead) => (
                <li key={lead.id}>
                  <Link href={`/pipeline/${lead.id}`} className="block border border-border p-3 hover:bg-accent">
                    <p className="text-sm font-medium">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.city || "город не указан"}</p>
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {shortDate(lead.createdAt)} · {lead.source}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        Всего {leads.length} · активные без учёта отказов:{" "}
        {leads.filter((l) => l.stage !== "lost" && l.stage !== "paid").length}
      </p>
    </div>
  );
}
