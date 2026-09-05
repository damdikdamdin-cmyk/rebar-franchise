import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canAccessTeam, ROLE_LABEL } from "@/lib/access";
import { createInvite } from "@/actions/ops";
import { Badge } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";
import { shortDate } from "@/lib/format";

const INVITE_ROLES: Role[] = ["uk_admin", "uk_sales", "uk_curator", "partner", "seller"];

export default async function TeamPage() {
  const user = await requireUser();
  if (!canAccessTeam(user.role)) redirect("/");

  const [users, invites, partners, stores] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { partner: true, store: true } }),
    prisma.invite.findMany({ where: { usedAt: null }, orderBy: { createdAt: "desc" } }),
    prisma.partner.findMany({ orderBy: { name: "asc" } }),
    prisma.store.findMany({ orderBy: { city: "asc" } }),
  ]);

  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Доступ</p>
        <h1 className="mt-1 font-serif text-4xl italic">Команда и приглашения</h1>
      </header>

      <form action={createInvite} className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="role">Роль</Label>
          <select id="role" name="role" className="flex h-9 w-full border border-input bg-background px-3 text-sm" defaultValue="uk_sales">
            {INVITE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="partnerId">Партнёр</Label>
          <select id="partnerId" name="partnerId" className="flex h-9 w-full border border-input bg-background px-3 text-sm" defaultValue="__none__">
            <option value="__none__">Нет</option>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="storeId">Точка (для продавца)</Label>
          <select id="storeId" name="storeId" className="flex h-9 w-full border border-input bg-background px-3 text-sm" defaultValue="__none__">
            <option value="__none__">Нет</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.city} · {store.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">Создать приглашение</Button>
        </div>
      </form>

      {invites.length > 0 ? (
        <section>
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Открытые ссылки</h2>
          <ul className="space-y-2">
            {invites.map((invite) => (
              <li key={invite.id} className="border border-border bg-card px-4 py-3 text-sm">
                <p>
                  {invite.email} · {ROLE_LABEL[invite.role]} · до {shortDate(invite.expiresAt)}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                  {baseUrl}/invite/{invite.token}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Пользователи</h2>
        <ul className="divide-y divide-border border border-border bg-card">
          {users.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="text-sm">{member.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{member.email}</p>
              </div>
              <Badge tone="steel">{ROLE_LABEL[member.role]}</Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
