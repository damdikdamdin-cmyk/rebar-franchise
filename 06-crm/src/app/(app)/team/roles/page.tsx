import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isAdmin, ROLE_LABEL } from "@/lib/access";
import { ensureSystemAccessRoles } from "@/lib/access-roles";
import { parsePermissions, storeManagerDefaults } from "@/lib/permissions";
import { deleteAccessRole, upsertAccessRole } from "@/actions/team";
import { RolePermissionsForm } from "@/components/role-permissions-form";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";

export default async function TeamRolesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  const user = await requireUser();
  const canEdit =
    isAdmin(user.role) || user.role === "uk_curator" || user.role === "partner" || user.role === "store_manager";
  if (!canEdit) redirect("/");

  await ensureSystemAccessRoles();
  const sp = await searchParams;

  const roles = await prisma.accessRole.findMany({
    where:
      user.role === "store_manager"
        ? { OR: [{ system: true, storeId: null }, { storeId: user.storeId }] }
        : user.role === "partner"
          ? {
              OR: [
                { system: true, storeId: null },
                { store: { partnerId: user.partnerId } },
                { storeId: null, system: false },
              ],
            }
          : {},
    include: { store: true, _count: { select: { users: true } } },
    orderBy: [{ system: "desc" }, { name: "asc" }],
  });

  const stores = await prisma.store.findMany({
    where:
      isAdmin(user.role) || user.role === "uk_curator"
        ? {}
        : user.role === "partner"
          ? { partnerId: user.partnerId }
          : { id: user.storeId ?? "__none__" },
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });

  const edit = sp.edit ? roles.find((r) => r.id === sp.edit) : null;
  const defaults = edit ? parsePermissions(edit.permissions) : storeManagerDefaults();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/team" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            ← Команда
          </Link>
          <h1 className="mt-1 font-serif text-3xl">Роли и права</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Шаблоны как в LiveSklad: галочки прав для продавцов и администраторов точки.
          </p>
        </div>
      </div>

      {sp.error === "name" ? (
        <p className="text-sm text-destructive">Укажите название роли.</p>
      ) : sp.error ? (
        <p className="text-sm text-destructive">Не удалось сохранить роль. Проверьте название и права.</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="border border-border bg-card">
          <h2 className="border-b border-border px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em]">
            Шаблоны · {roles.length}
          </h2>
          <ul className="divide-y divide-border">
            {roles.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {r.name}
                    {r.system ? <span className="ml-2 text-xs text-muted-foreground">пресет</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.store ? `${r.store.city} · ${r.store.name}` : "Сеть"} · сотрудников: {r._count.users}
                  </p>
                </div>
                <Link
                  href={`/team/roles?edit=${r.id}`}
                  className="font-mono text-[10px] uppercase underline"
                >
                  изменить
                </Link>
                {!r.system ? (
                  <form action={deleteAccessRole}>
                    <input type="hidden" name="id" value={r.id} />
                    <Button type="submit" size="xs" variant="ghost">
                      удалить
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="border border-border bg-card p-4">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em]">
            {edit ? `Редактировать · ${edit.name}` : "Добавить роль"}
          </h2>
          <form key={edit?.id ?? "new"} action={upsertAccessRole} className="space-y-3">
            {edit ? <input type="hidden" name="id" value={edit.id} /> : null}
            <div>
              <Label>Название *</Label>
              <Input name="name" required defaultValue={edit?.name ?? ""} placeholder="Например: Старший продавец" />
            </div>
            <div>
              <Label>Начальная страница</Label>
              <Input name="homePage" defaultValue={edit?.homePage ?? "/pos"} placeholder="/pos" />
            </div>
            {stores.length && user.role !== "store_manager" ? (
              <div>
                <Label>Точка (пусто = сеть / пресет)</Label>
                <select
                  name="storeId"
                  defaultValue={edit?.storeId ?? ""}
                  className="h-9 w-full border border-border bg-background px-2 text-sm"
                >
                  <option value="">— сеть —</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.city} · {s.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {user.role === "store_manager" && user.storeId ? (
              <input type="hidden" name="storeId" value={user.storeId} />
            ) : null}
            <RolePermissionsForm key={edit?.id ?? "new-perms"} defaults={defaults} />
            <div className="flex gap-2 pt-2">
              <Button type="submit">{edit ? "Сохранить" : "Создать роль"}</Button>
              {edit ? (
                <Link href="/team/roles" className="border border-border px-3 py-2 text-sm">
                  Отмена
                </Link>
              ) : null}
            </div>
            {edit?.system ? (
              <p className="text-xs text-muted-foreground">
                Системный пресет: при сохранении создаётся/обновляется роль. Пресеты сети больше не затираются при открытии страницы.
              </p>
            ) : null}
          </form>
        </section>
      </div>

      <p className="text-xs text-muted-foreground">
        Системные роли УК ({ROLE_LABEL.founder}, {ROLE_LABEL.uk_curator}…) по-прежнему задаются в карточке участника.
        Здесь — только розничные галочки для сотрудников точки.
      </p>
    </div>
  );
}
