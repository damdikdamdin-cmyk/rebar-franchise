import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { assertStoreAccess, isUk, ROLE_LABEL } from "@/lib/access";
import { updateStore } from "@/actions/partners";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Card, Field, Input } from "@/components/ui/fields";
import { FORMAT_LABEL, KIND_LABEL, rub, STORE_STATUS_LABEL } from "@/lib/format";
import { courseProgress } from "@/lib/learning";

export default async function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const store = await prisma.store.findUnique({
    where: { id },
    include: {
      partner: true,
      staff: { include: { enrollments: { include: { course: { include: { lessons: true } }, progress: true } } } },
      launchProjects: true,
      sales: { where: { soldAt: { gte: since }, deletedAt: null } },
      balances: true,
      cashRegisters: true,
      orders: { where: { status: "reserved" } },
    },
  });
  if (!store) notFound();
  if (!assertStoreAccess(user, store)) redirect("/stores");
  const canEdit = isUk(user.role) || user.role === "partner";

  const revenue = store.sales.reduce((s, x) => s + x.amount, 0);
  const stockSku = store.balances.filter((b) => b.qty > 0).length;
  const cash = store.cashRegisters.reduce((s, r) => s + r.balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{KIND_LABEL[store.kind]}</Badge>
        <Badge tone="steel">{FORMAT_LABEL[store.format]}</Badge>
        <Badge tone={store.status === "open" ? "success" : "steel"}>{STORE_STATUS_LABEL[store.status]}</Badge>
        {store.launchProjects[0] ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/launches/${store.launchProjects[0].id}`}>Запуск</Link>
          </Button>
        ) : null}
      </div>

      <section className="grid gap-px bg-border sm:grid-cols-4">
        <Stat label="Выручка 30 дн" value={rub(revenue)} />
        <Stat label="Чеки" value={String(store.sales.length)} />
        <Stat label="SKU на складе" value={String(stockSku)} />
        <Stat label="Касса" value={rub(cash)} />
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["pos", "Продажи"],
          ["stock", "Остатки"],
          ["receipts", "Поступления"],
          ["orders", "Заказы"],
          ["warranty", "Гарантии"],
          ["reports", "Отчёты"],
        ].map(([slug, label]) => (
          <Link key={slug} href={`/stores/${id}/${slug}`} className="border border-border bg-card px-4 py-5 hover:bg-accent">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em]">{label}</p>
          </Link>
        ))}
      </div>

      {store.orders.length ? (
        <p className="text-sm text-muted-foreground">Открытых заказов: {store.orders.length}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-4 py-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xl">{value}</p>
    </div>
  );
}
