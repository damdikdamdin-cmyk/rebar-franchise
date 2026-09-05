import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isAdmin, isUk } from "@/lib/access";
import { createPartnerDirect } from "@/actions/partners";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Card, Field, Input, PageHeader, Select } from "@/components/ui/fields";
import { FORMAT_LABEL, PARTNER_STATUS_LABEL, shortDate } from "@/lib/format";
import { courseProgress } from "@/lib/learning";

export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const user = await requireUser();
  if (!isUk(user.role)) redirect(user.partnerId ? `/partners/${user.partnerId}` : "/");
  const sp = await searchParams;
  const [partners, curators] = await Promise.all([
    prisma.partner.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        curator: { select: { name: true } },
        stores: true,
        users: { include: { enrollments: { include: { course: { include: { lessons: true } }, progress: true } } } },
        launchProjects: { include: { tasks: true } },
      },
    }),
    prisma.user.findMany({ where: { role: { in: ["uk_curator", "founder", "uk_admin"] } }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow={`${partners.length} партнёров · ${partners.filter((p) => p.status === "onboarding").length} в запуске`}
        title="Партнёры"
        actions={
          isAdmin(user.role) ? (
            <Button asChild size="sm">
              <Link href="/partners?new=1">Добавить партнёра</Link>
            </Button>
          ) : null
        }
      />

      {sp.new ? (
        <Card className="mb-6 px-5 py-5">
          <p className="eyebrow mb-1">Партнёр без лида</p>
          <p className="mb-3 text-xs text-muted-foreground">Обычно партнёр появляется из воронки. Здесь — для уже подписанных.</p>
          <form action={createPartnerDirect} className="grid gap-3 sm:grid-cols-3">
            <Field label="Имя">
              <Input name="name" required />
            </Field>
            <Field label="Город">
              <Input name="city" required />
            </Field>
            <Field label="Email (для инвайта)">
              <Input name="email" type="email" />
            </Field>
            <Field label="Телефон">
              <Input name="phone" />
            </Field>
            <Field label="Формат">
              <Select name="format" defaultValue="standard">
                {Object.entries(FORMAT_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Куратор">
              <Select name="curatorUserId" defaultValue="">
                <option value="">—</option>
                {curators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex gap-2 sm:col-span-3">
              <Button type="submit">Создать и запустить</Button>
              <Button asChild variant="ghost">
                <Link href="/partners">Отмена</Link>
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="divide-y divide-border">
        {partners.map((p) => {
          const project = p.launchProjects.find((l) => l.status === "active");
          const done = project ? project.tasks.filter((t) => t.status === "done").length : 0;
          const owner = p.users.find((u) => u.role === "partner");
          const enroll = owner?.enrollments[0];
          const learn = enroll ? courseProgress(enroll) : null;
          return (
            <Link key={p.id} href={`/partners/${p.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-accent">
              <Avatar name={p.name} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {p.city} · {p.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.company ?? "ИП не указан"} · {FORMAT_LABEL[p.format]} · куратор {p.curator?.name ?? "—"} · с {shortDate(p.signedAt)}
                </p>
              </div>
              {project ? (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-foreground" style={{ width: `${(done / project.tasks.length) * 100}%` }} />
                  </div>
                  <span className="font-mono text-[10px]">
                    {done}/{project.tasks.length}
                  </span>
                </div>
              ) : null}
              {learn ? <Badge tone={learn.pct === 100 ? "success" : "steel"}>курс {learn.pct}%</Badge> : <Badge>нет аккаунта</Badge>}
              <Badge tone={p.status === "active" ? "success" : p.status === "onboarding" ? "steel" : "warn"}>{PARTNER_STATUS_LABEL[p.status]}</Badge>
            </Link>
          );
        })}
      </Card>
    </div>
  );
}
