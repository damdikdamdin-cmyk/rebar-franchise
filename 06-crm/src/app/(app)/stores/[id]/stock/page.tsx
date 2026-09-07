import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StockTable } from "@/components/stock-table";

export default async function StockPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ group?: string; deleted?: string }>;
}) {
  const { id } = await params;
  const { group, deleted } = await searchParams;
  const showDeleted = deleted === "1";
  const groups = await prisma.productGroup.findMany({ orderBy: { name: "asc" } });
  const balances = await prisma.stockBalance.findMany({
    where: {
      storeId: id,
      product: {
        ...(group ? { groupId: group } : {}),
        ...(showDeleted ? {} : { deletedAt: null }),
      },
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
    deletedAt: b.product.deletedAt,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/stores/${id}/stock`} className="border border-border px-2 py-1 font-mono text-[10px] uppercase">
          Все
        </Link>
        {groups.map((g) => (
          <Link
            key={g.id}
            href={`/stores/${id}/stock?group=${g.id}${showDeleted ? "&deleted=1" : ""}`}
            className="border border-border px-2 py-1 font-mono text-[10px] uppercase text-muted-foreground"
          >
            {g.name}
          </Link>
        ))}
        <Link
          href={`/stores/${id}/stock?deleted=1${group ? `&group=${group}` : ""}`}
          className={`ml-auto border px-2 py-1 font-mono text-[10px] uppercase ${
            showDeleted ? "border-red-600 text-red-600" : "border-border text-muted-foreground"
          }`}
        >
          Удалённые ×
        </Link>
      </div>
      <StockTable storeId={id} rows={rows} showDelete={!showDeleted} />
    </div>
  );
}
