import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/fields";
import { rub } from "@/lib/format";

export default async function StockPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ group?: string }>;
}) {
  const { id } = await params;
  const { group } = await searchParams;
  const groups = await prisma.productGroup.findMany({ orderBy: { name: "asc" } });
  const balances = await prisma.stockBalance.findMany({
    where: {
      storeId: id,
      ...(group ? { product: { groupId: group } } : {}),
    },
    include: {
      product: { include: { group: true, balances: true } },
    },
    orderBy: { product: { name: "asc" } },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link href={`/stores/${id}/stock`} className="border border-border px-2 py-1 font-mono text-[10px] uppercase">
          Все
        </Link>
        {groups.map((g) => (
          <Link
            key={g.id}
            href={`/stores/${id}/stock?group=${g.id}`}
            className="border border-border px-2 py-1 font-mono text-[10px] uppercase text-muted-foreground"
          >
            {g.name}
          </Link>
        ))}
      </div>
      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3">Товар</th>
              <th className="px-4 py-3">Группа</th>
              <th className="px-4 py-3">Кол-во</th>
              <th className="px-4 py-3">Другие точки</th>
              <th className="px-4 py-3">Розница</th>
              <th className="px-4 py-3">Мин.</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => {
              const other = b.product.balances.filter((x) => x.storeId !== id).reduce((s, x) => s + x.qty, 0);
              return (
                <tr key={b.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/catalog/products/${b.productId}`} className="hover:underline">
                      {b.product.name}
                    </Link>
                    <div className="font-mono text-[10px] text-muted-foreground">Код: {b.product.code}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{b.product.group?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono">
                    {b.qty}
                    {b.qty <= b.product.minStock ? (
                      <Badge tone="warn" className="ml-2">
                        низкий
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{other}</td>
                  <td className="px-4 py-3 font-mono">{rub(b.product.retailPrice)}</td>
                  <td className="px-4 py-3 font-mono">{b.product.minStock}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        Всего позиций — {balances.length}
      </p>
    </div>
  );
}
