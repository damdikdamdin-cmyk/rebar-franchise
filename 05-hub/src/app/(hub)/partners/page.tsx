import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isUk, partnerWhere } from "@/lib/access";
import { FORMAT_LABEL, PARTNER_STATUS_LABEL } from "@/lib/format";
import { Badge } from "@/components/ui/fields";

export default async function PartnersPage() {
  const user = await requireUser();
  if (!isUk(user.role) && user.role !== "partner") redirect("/");

  const partners = await prisma.partner.findMany({
    where: partnerWhere(user),
    include: {
      stores: true,
      curator: true,
      launchProjects: { include: { tasks: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Партнёрская программа</p>
        <h1 className="mt-1 font-serif text-4xl italic">Партнёры</h1>
      </header>
      <ul className="divide-y divide-border border border-border bg-card">
        {partners.map((partner) => {
          const project = partner.launchProjects[0];
          const done = project?.tasks.filter((t) => t.status === "done").length ?? 0;
          const total = project?.tasks.length ?? 0;
          return (
            <li key={partner.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div>
                <Link href={`/partners/${partner.id}`} className="font-medium hover:underline">
                  {partner.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {partner.city} · {FORMAT_LABEL[partner.format]}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={partner.status === "active" ? "open" : "steel"}>
                  {PARTNER_STATUS_LABEL[partner.status]}
                </Badge>
                {project ? (
                  <Link href={`/partners/${partner.id}/launch`} className="font-mono text-xs uppercase tracking-[0.12em] underline">
                    Запуск {done}/{total}
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
