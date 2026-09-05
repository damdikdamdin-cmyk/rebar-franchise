import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { LeadStage, StoreFormat } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canAccessPipeline } from "@/lib/access";
import { FORMAT_LABEL, LEAD_STAGES, dateTime } from "@/lib/format";
import { addLeadNote, convertLead, updateLeadStage } from "@/actions/ops";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/fields";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canAccessPipeline(user.role)) redirect("/");
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { owner: true, partner: true, activities: { include: { user: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!lead) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href="/pipeline" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          ← Воронка
        </Link>
        <h1 className="mt-2 font-serif text-4xl italic">{lead.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {lead.phone}
          {lead.city ? ` · ${lead.city}` : ""}
          {lead.source ? ` · ${lead.source}` : ""}
        </p>
      </div>

      {lead.note ? (
        <p className="border border-border bg-card px-4 py-3 text-sm">{lead.note}</p>
      ) : null}

      <form action={moveStage.bind(null, lead.id)} className="flex flex-wrap gap-2">
        {LEAD_STAGES.map((stage) => (
          <Button
            key={stage.id}
            name="stage"
            value={stage.id}
            variant={lead.stage === stage.id ? "default" : "outline"}
            size="sm"
          >
            {stage.label}
          </Button>
        ))}
      </form>

      {lead.partner ? (
        <p className="text-sm">
          Партнёр:{" "}
          <Link href={`/partners/${lead.partner.id}/launch`} className="underline">
            {lead.partner.name}
          </Link>
        </p>
      ) : (
        <section className="border border-border bg-card p-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">После оплаты</h2>
          <p className="mt-1 text-sm text-muted-foreground">Создаёт партнёра, точку и чеклист запуска на 90 дней.</p>
          <form action={convertLead} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="leadId" value={lead.id} />
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="partnerName">Имя партнёра</Label>
              <Input id="partnerName" name="partnerName" defaultValue={lead.name} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="city">Город</Label>
              <Input id="city" name="city" defaultValue={lead.city ?? ""} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="format">Формат</Label>
              <select
                id="format"
                name="format"
                defaultValue="standard"
                className="flex h-9 w-full border border-input bg-card px-3 text-sm"
              >
                {(Object.keys(FORMAT_LABEL) as StoreFormat[]).map((key) => (
                  <option key={key} value={key}>
                    {FORMAT_LABEL[key]}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Создать партнёра и запуск</Button>
            </div>
          </form>
        </section>
      )}

      <section>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Заметки</h2>
        <form action={addLeadNote} className="mt-3 space-y-2">
          <input type="hidden" name="leadId" value={lead.id} />
          <Textarea name="body" placeholder="Звонок, возражение, следующий шаг" required />
          <Button type="submit" variant="outline" size="sm">
            Добавить
          </Button>
        </form>
        <ul className="mt-4 space-y-3">
          {lead.activities.map((item) => (
            <li key={item.id} className="border-b border-border pb-3 text-sm last:border-0">
              <p>{item.body}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {item.user?.name ?? "система"} · {dateTime(item.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

async function moveStage(leadId: string, formData: FormData) {
  "use server";
  const stage = String(formData.get("stage") ?? "") as LeadStage;
  if (!stage) return;
  await updateLeadStage(leadId, stage);
}
