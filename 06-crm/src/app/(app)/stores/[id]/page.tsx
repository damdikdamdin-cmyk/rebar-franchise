import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { assertStoreAccess, isUk, ROLE_LABEL } from "@/lib/access";
import { updateStore } from "@/actions/partners";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Card, Field, Input, PageHeader } from "@/components/ui/fields";
import { FORMAT_LABEL, KIND_LABEL, STORE_STATUS_LABEL } from "@/lib/format";
import { courseProgress } from "@/lib/learning";

export default async function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const store = await prisma.store.findUnique({
    where: { id },
    include: {
      partner: true,
      staff: { include: { enrollments: { include: { course: { include: { lessons: true } }, progress: true } } } },
      launchProjects: true,
    },
  });
  if (!store) notFound();
  if (!assertStoreAccess(user, store)) redirect("/stores");
  const canEdit = isUk(user.role) || user.role === "partner";
  const hubUrl = process.env.HUB_URL ?? "http://localhost:3000";

  return (
    <div>
      <PageHeader
        eyebrow={`${KIND_LABEL[store.kind]} · ${FORMAT_LABEL[store.format]}`}
        title={store.name}
        description={store.address ?? "Адрес не указан"}
        actions={
          <>
            <Badge tone={store.status === "open" ? "success" : "steel"}>{STORE_STATUS_LABEL[store.status]}</Badge>
            {store.status === "open" ? (
              <Button asChild size="sm" variant="outline">
                <a href={hubUrl} target="_blank" rel="noreferrer">
                  <ExternalLink /> Розница в Hub
                </a>
              </Button>
            ) : null}
            {store.launchProjects[0] ? (
              <Button asChild size="sm">
                <Link href={`/launches/${store.launchProjects[0].id}`}>Запуск</Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section>
            <p className="eyebrow mb-2">Команда точки · {store.staff.length}</p>
            <Card className="divide-y divide-border">
              {store.staff.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  Сотрудников нет.{" "}
                  {canEdit ? (
                    <Link href="/team" className="underline underline-offset-4">
                      Пригласить
                    </Link>
                  ) : null}
                </p>
              ) : null}
              {store.staff.map((u) => {
                const e = u.enrollments.find((x) => x.course.slug === "seller-day") ?? u.enrollments[0];
                return (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={u.name} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{u.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_LABEL[u.role]} · {u.email}
                      </p>
                    </div>
                    {e ? <Badge tone={e.completedAt ? "success" : "steel"}>обучение {courseProgress(e).pct}%</Badge> : null}
                  </div>
                );
              })}
            </Card>
          </section>

          <section>
            <p className="eyebrow mb-2">Стандарты точки</p>
            <Card className="divide-y divide-border">
              {[
                { href: "/kb/chek-list-rabochego-dnya", t: "Чек-лист рабочего дня" },
                { href: "/kb/retail-marketing-kb", t: "Маркетинг и стандарты сервиса" },
                { href: "/kb/cutover-hub", t: "Учёт в Hub: переход и правила" },
                { href: "/learn/seller-day", t: "Курс «Рабочий день продавца»" },
              ].map((l) => (
                <Link key={l.href} href={l.href} className="block px-4 py-2.5 text-sm hover:bg-accent">
                  {l.t}
                </Link>
              ))}
            </Card>
          </section>
        </div>

        <Card className="h-fit px-5 py-5">
          <p className="eyebrow mb-3">Карточка</p>
          {canEdit ? (
            <form action={updateStore} className="space-y-3">
              <input type="hidden" name="id" value={store.id} />
              <Field label="Название">
                <Input name="name" defaultValue={store.name} />
              </Field>
              <Field label="Адрес">
                <Input name="address" defaultValue={store.address ?? ""} />
              </Field>
              <Field label="Телефон">
                <Input name="phone" defaultValue={store.phone ?? ""} />
              </Field>
              <Button type="submit" variant="secondary" className="w-full">
                Сохранить
              </Button>
            </form>
          ) : (
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="eyebrow">Город</dt>
                <dd>{store.city}</dd>
              </div>
              <div>
                <dt className="eyebrow">Телефон</dt>
                <dd>{store.phone ?? "—"}</dd>
              </div>
            </dl>
          )}
          {store.partner ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Партнёр:{" "}
              <Link href={`/partners/${store.partner.id}`} className="underline underline-offset-4">
                {store.partner.name}
              </Link>
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
