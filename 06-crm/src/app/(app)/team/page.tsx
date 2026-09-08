import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ALL_ROLES, canManageTeam, isUk, ROLE_LABEL, STORE_ROLES, UK_ROLES } from "@/lib/access";
import { createInvite, revokeInvite, updateMemberRole, assignAccessRole } from "@/actions/team";
import { ensureSystemAccessRoles } from "@/lib/access-roles";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Card, Empty, Field, Input, PageHeader, Select } from "@/components/ui/fields";
import { CopyButton } from "@/components/copy-button";
import { dateTime, shortDate } from "@/lib/format";

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const admin = canManageTeam(user.role);
  const canSee =
    admin || user.role === "partner" || user.role === "uk_curator" || user.role === "store_manager";
  if (!canSee) redirect("/");

  await ensureSystemAccessRoles();

  const partnerScope = user.role === "partner" ? { partnerId: user.partnerId } : {};
  const curatorScope = user.role === "uk_curator" ? { partner: { curatorUserId: user.id } } : {};
  const storeMgrScope = user.role === "store_manager" ? { storeId: user.storeId } : {};

  const [members, invites, partners, stores, accessRoles] = await Promise.all([
    prisma.user.findMany({
      where: admin
        ? {}
        : user.role === "partner"
          ? { partnerId: user.partnerId }
          : user.role === "store_manager"
            ? { storeId: user.storeId }
            : { OR: [{ partner: { curatorUserId: user.id } }, { id: user.id }] },
      include: {
        partner: true,
        store: true,
        accessRole: true,
        enrollments: { include: { course: { include: { lessons: true } }, progress: true } },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    prisma.invite.findMany({
      where: {
        usedAt: null,
        expiresAt: { gt: new Date() },
        ...(admin
          ? {}
          : user.role === "partner"
            ? partnerScope
            : user.role === "store_manager"
              ? storeMgrScope
              : curatorScope),
      },
      include: { partner: true, store: true, accessRole: true },
      orderBy: { createdAt: "desc" },
    }),
    admin
      ? prisma.partner.findMany({ orderBy: { name: "asc" } })
      : user.role === "uk_curator"
        ? prisma.partner.findMany({ where: { curatorUserId: user.id }, orderBy: { name: "asc" } })
        : [],
    prisma.store.findMany({
      where: admin
        ? {}
        : user.role === "partner"
          ? { partnerId: user.partnerId }
          : user.role === "store_manager"
            ? { id: user.storeId ?? "__none__" }
            : { partner: { curatorUserId: user.id } },
      orderBy: [{ city: "asc" }, { name: "asc" }],
    }),
    prisma.accessRole.findMany({
      where:
        user.role === "store_manager"
          ? { OR: [{ system: true, storeId: null }, { storeId: user.storeId }] }
          : {},
      orderBy: [{ system: "desc" }, { name: "asc" }],
    }),
  ]);

  const roleOptions = admin
    ? ALL_ROLES
    : user.role === "partner"
      ? (["store_manager", "seller"] as const)
      : user.role === "store_manager"
        ? (["seller", "store_manager"] as const)
        : (["partner", "store_manager", "seller"] as const);
  const appUrl = process.env.APP_URL ?? "http://localhost:3100";

  return (
    <div>
      <PageHeader
        eyebrow="Настройки"
        title="Команда"
        description={
          admin
            ? "Приглашения в УК, партнёрам и сотрудникам точек. Ссылка живёт 14 дней."
            : "Приглашайте сотрудников своих точек. Ссылку отправьте лично — почта не используется."
        }
        actions={
          <Link
            href="/team/roles"
            className="border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em]"
          >
            Роли и права
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section>
            <h2 className="eyebrow mb-2">Участники · {members.length}</h2>
            <Card className="divide-y divide-border">
              {members.map((m) => {
                const done = m.enrollments.filter((e) => e.completedAt).length;
                return (
                  <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <Avatar name={m.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{m.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.email}
                        {m.partner ? ` · ${m.partner.city} ${m.partner.name}` : ""}
                        {m.store ? ` · ${m.store.name}` : ""}
                      </p>
                    </div>
                    {m.enrollments.length ? (
                      <Badge tone={done === m.enrollments.length ? "success" : "steel"}>
                        курсы {done}/{m.enrollments.length}
                      </Badge>
                    ) : null}
                    {admin && m.id !== user.id ? (
                      <form action={updateMemberRole} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={m.id} />
                        <Select name="role" defaultValue={m.role} className="h-7 w-44 text-xs">
                          {ALL_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </Select>
                        <Button type="submit" size="xs" variant="outline">
                          Сохранить
                        </Button>
                      </form>
                    ) : (
                      <Badge tone="steel">{ROLE_LABEL[m.role]}</Badge>
                    )}
                    {STORE_ROLES.includes(m.role) || m.role === "partner" ? (
                      <form action={assignAccessRole} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={m.id} />
                        <Select name="accessRoleId" defaultValue={m.accessRoleId ?? ""} className="h-7 w-48 text-xs">
                          <option value="">права по роли</option>
                          {accessRoles.map((ar) => (
                            <option key={ar.id} value={ar.id}>
                              {ar.name}
                              {ar.system ? " · пресет" : ""}
                            </option>
                          ))}
                        </Select>
                        <Button type="submit" size="xs" variant="outline">
                          Права
                        </Button>
                      </form>
                    ) : m.accessRole ? (
                      <Badge tone="steel">{m.accessRole.name}</Badge>
                    ) : null}
                    <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
                      {m.lastSeenAt ? `был ${dateTime(m.lastSeenAt)}` : "не входил"}
                    </span>
                  </div>
                );
              })}
            </Card>
          </section>

          <section>
            <h2 className="eyebrow mb-2">Активные приглашения · {invites.length}</h2>
            {invites.length === 0 ? (
              <Empty title="Открытых приглашений нет" />
            ) : (
              <Card className="divide-y divide-border">
                {invites.map((i) => (
                  <div key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{i.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_LABEL[i.role]}
                        {i.partner ? ` · ${i.partner.name}` : ""}
                        {i.store ? ` · ${i.store.name}` : ""} · до {shortDate(i.expiresAt)}
                      </p>
                    </div>
                    <CopyButton text={`${appUrl}/join/${i.token}`} label="Скопировать ссылку" />
                    <form action={revokeInvite}>
                      <input type="hidden" name="id" value={i.id} />
                      <Button type="submit" size="xs" variant="ghost">
                        Отозвать
                      </Button>
                    </form>
                  </div>
                ))}
              </Card>
            )}
          </section>
        </div>

        <Card className="h-fit px-5 py-5">
          <p className="eyebrow">Новое приглашение</p>
          {sp.error ? <p className="mt-2 text-xs text-destructive">Нет прав на такое приглашение.</p> : null}
          <form action={createInvite} className="mt-4 space-y-3">
            <Field label="Имя">
              <Input name="name" placeholder="Как в чеках и документах" />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" required />
            </Field>
            <Field label="Роль">
              <Select name="role" defaultValue={admin ? "uk_sales" : "seller"}>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
            </Field>
            {accessRoles.length ? (
              <Field label="Шаблон прав" hint="Галочки продаж / склада / кассы">
                <Select name="accessRoleId" defaultValue={accessRoles.find((a) => a.name === "Продавец")?.id ?? ""}>
                  <option value="">— по системной роли —</option>
                  {accessRoles.map((ar) => (
                    <option key={ar.id} value={ar.id}>
                      {ar.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            {partners.length ? (
              <Field label="Партнёр" hint="Для роли партнёра и его сотрудников">
                <Select name="partnerId" defaultValue="">
                  <option value="">—</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.city} · {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Точка" hint="Для управляющего и продавца">
              <Select name="storeId" defaultValue="">
                <option value="">—</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.city} · {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" className="w-full">
              Создать ссылку
            </Button>
          </form>
          {isUk(user.role) ? (
            <p className="mt-4 text-xs text-muted-foreground">
              УК-роли: {UK_ROLES.map((r) => ROLE_LABEL[r]).join(", ")}. Роли точки: {STORE_ROLES.map((r) => ROLE_LABEL[r]).join(", ")}.
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
