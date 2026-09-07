import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StockTable } from "@/components/stock-table";

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

  const rows = balances.map((b) => ({
    id: b.id,
    productId: b.productId,
    name: b.product.name,
    code: b.product.code,
    barcode: b.product.barcode,
    group: b.product.group?.name ?? null,
    qty: b.qty,
    otherQty: b.product.balances.filter((x) => x.storeId !== id).reduce((s, x) => s + x.qty, 0),
    retailPrice: b.product.retailPrice,
    minStock: b.product.minStock,
  }));

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
      <StockTable storeId={id} rows={rows} />
    </div>
  );
}
