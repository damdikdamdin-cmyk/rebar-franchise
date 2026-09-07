import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isUk } from "@/lib/access";
import { FORMAT_LABEL, KIND_LABEL, PARTNER_STATUS_LABEL, STORE_STATUS_LABEL, shortDate } from "@/lib/format";
import { Badge } from "@/components/ui/fields";

export default async function PartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!isUk(user.role) && user.partnerId !== id) redirect("/");

  const partner = await prisma.partner.findUnique({
    where: { id },
    include: { stores: true, curator: true, launchProjects: true, leads: true },
  });
  if (!partner) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href="/partners" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          ← Партнёры
        </Link>
        <h1 className="mt-2 font-serif text-4xl">{partner.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {partner.city} · {FORMAT_LABEL[partner.format]}
          {partner.signedAt ? ` · договор ${shortDate(partner.signedAt)}` : ""}
        </p>
        <div className="mt-3 flex gap-2">
          <Badge>{PARTNER_STATUS_LABEL[partner.status]}</Badge>
          {partner.curator ? <Badge tone="steel">Куратор: {partner.curator.name}</Badge> : null}
        </div>
      </div>

      {partner.launchProjects[0] ? (
        <Link href={`/partners/${partner.id}/launch`} className="inline-flex border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
          Открыть чеклист запуска 60–90 дней
        </Link>
      ) : null}

      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Точки</h2>
        <ul className="divide-y divide-border border border-border bg-card">
          {partner.stores.map((store) => (
            <li key={store.id} className="flex items-center justify-between px-4 py-3">
              <Link href={`/stores/${store.id}`} className="hover:underline">
                {store.name}
              </Link>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {KIND_LABEL[store.kind]} · {STORE_STATUS_LABEL[store.status]}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
