import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isUk, ROLE_LABEL } from "@/lib/access";
import { courseProgress } from "@/lib/learning";
import { Avatar, Badge, Card, PageHeader } from "@/components/ui/fields";
import { shortDate } from "@/lib/format";

export default async function ProgressPage() {
  const user = await requireUser();
  if (!isUk(user.role) && user.role !== "partner") redirect("/learn");

  const users = await prisma.user.findMany({
    where: user.role === "partner" ? { partnerId: user.partnerId } : user.role === "uk_curator" ? { partner: { curatorUserId: user.id } } : {},
    include: {
      partner: true,
      store: true,
      enrollments: { include: { course: { include: { lessons: true } }, progress: true } },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <PageHeader eyebrow="Обучение" title="Прогресс команды" description="Кто что изучил. Завершение курса приходит в инбокс куратору и УК." />
      <Card className="divide-y divide-border">
        {users
          .filter((u) => u.enrollments.length)
          .map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar name={u.name} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{u.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ROLE_LABEL[u.role]}
                  {u.partner ? ` · ${u.partner.city}` : ""}
                  {u.store ? ` · ${u.store.name}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {u.enrollments.map((e) => {
                  const p = courseProgress(e);
                  return (
                    <div key={e.id} className="rounded-md border border-border px-2 py-1">
                      <p className="text-xs">{e.course.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1 w-20 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-foreground" style={{ width: `${p.pct}%` }} />
                        </div>
                        {e.completedAt ? <Badge tone="success">{shortDate(e.completedAt)}</Badge> : <span className="font-mono text-[10px]">{p.pct}%</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </Card>
    </div>
  );
}
