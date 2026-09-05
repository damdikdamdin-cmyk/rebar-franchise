import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { storeWhere } from "@/lib/access";
import { Badge, Card, PageHeader } from "@/components/ui/fields";
import { FORMAT_LABEL, KIND_LABEL, shortDate, STORE_STATUS_LABEL } from "@/lib/format";

export default async function StoresPage() {
  const user = await requireUser();
  const stores = await prisma.store.findMany({
    where: storeWhere(user),
    include: { partner: true, staff: true },
    orderBy: [{ status: "asc" }, { city: "asc" }],
  });
  return (
    <div>
      <PageHeader eyebrow={`${stores.length} точек`} title="Точки" description="Розничный учёт (продажи, склад, касса) ведётся в re:bar Hub. Здесь — карточка, команда и стандарты." />
      <Card className="divide-y divide-border">
        {stores.map((s) => (
          <Link key={s.id} href={`/stores/${s.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-accent">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">
                {KIND_LABEL[s.kind]} · {FORMAT_LABEL[s.format]} · {s.partner ? s.partner.name : "УК"} · {s.staff.length} сотрудников
                {s.openedAt ? ` · открыта ${shortDate(s.openedAt)}` : ""}
              </p>
            </div>
            <Badge tone={s.status === "open" ? "success" : s.status === "launch" ? "steel" : "default"}>{STORE_STATUS_LABEL[s.status]}</Badge>
          </Link>
        ))}
      </Card>
    </div>
  );
}
