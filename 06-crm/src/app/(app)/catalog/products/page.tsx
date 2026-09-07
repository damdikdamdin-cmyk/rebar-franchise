import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canAccessRetail, canEditCatalog } from "@/lib/access";
import { createProductGroup, createSupplier } from "@/actions/retail";
import { Button } from "@/components/ui/button";
import { Input, Label, Badge } from "@/components/ui/fields";
import { rub } from "@/lib/format";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const user = await requireUser();
  if (!canAccessRetail(user.role)) redirect("/");
  const canEdit = canEditCatalog(user.role);
  const { group } = await searchParams;
  const groups = await prisma.productGroup.findMany({
    include: { _count: { select: { products: true } }, children: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const products = await prisma.product.findMany({
    where: group ? { groupId: group } : undefined,
    include: {
      group: true,
      balances: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Справочник</p>
          <h1 className="mt-1 font-serif text-4xl">Товары</h1>
        </div>
        {canEdit ? (
          <Link href="/catalog/products/new">
            <Button>+ Товар</Button>
          </Link>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-4">
          <div className="border border-border bg-card p-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Группы</p>
            <Link href="/catalog/products" className="block py-1 text-sm hover:underline">
              Все товары ({products.length})
            </Link>
            {groups
              .filter((g) => !g.parentId)
              .map((g) => (
                <div key={g.id} className="mt-2">
                  <Link href={`/catalog/products?group=${g.id}`} className="text-sm hover:underline">
                    {g.name}
                  </Link>
                  {g.children.map((c) => (
                    <Link
                      key={c.id}
                      href={`/catalog/products?group=${c.id}`}
                      className="ml-3 block py-0.5 text-sm text-muted-foreground hover:underline"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              ))}
          </div>
          <form action={createProductGroup} className="space-y-2 border border-border bg-card p-3">
            <Label>Новая группа</Label>
            <Input name="name" required disabled={!canEdit} />
            <Button type="submit" size="sm" variant="outline" disabled={!canEdit}>
              Добавить
            </Button>
          </form>
          <form action={createSupplier} className="space-y-2 border border-border bg-card p-3">
            <Label>Поставщик</Label>
            <Input name="name" required placeholder="Название" disabled={!canEdit} />
            <Input name="phone" placeholder="Телефон" disabled={!canEdit} />
            <Button type="submit" size="sm" variant="outline" disabled={!canEdit}>
              Добавить
            </Button>
          </form>
        </aside>

        <div className="overflow-x-auto border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3">Наименование</th>
                <th className="px-4 py-3">Группа</th>
                <th className="px-4 py-3">Кол-во</th>
                <th className="px-4 py-3">Мин.</th>
                <th className="px-4 py-3">Розница</th>
                <th className="px-4 py-3">Закуп</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const qty = p.balances.reduce((s, b) => s + b.qty, 0);
                return (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/catalog/products/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        Код: {p.code}
                        {p.serialTracked ? " · S/N" : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.group?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-mono">
                      {qty}
                      {qty <= p.minStock ? (
                        <Badge tone="warn" className="ml-2">
                          низкий
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono">{p.minStock}</td>
                    <td className="px-4 py-3 font-mono">{rub(p.retailPrice)}</td>
                    <td className="px-4 py-3 font-mono">{rub(p.purchasePrice)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
