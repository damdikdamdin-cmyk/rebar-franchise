import { prisma } from "@/lib/prisma";
import { StockDocForm } from "@/components/stock-doc-form";
import { DocTable } from "@/components/doc-table";

export default async function InventoriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const products = await prisma.product.findMany({
    where: { active: true },
    include: { balances: { where: { storeId: id } } },
    orderBy: { name: "asc" },
  });
  const opts = products.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    purchasePrice: p.purchasePrice,
    retailPrice: p.retailPrice,
    qty: p.balances[0]?.qty ?? 0,
  }));
  const docs = await prisma.stockDocument.findMany({
    where: { storeId: id, type: "inventory" },
    include: { supplier: true, user: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <StockDocForm storeId={id} type="inventory" products={opts} title="Инвентаризация" />
      <DocTable docs={docs} total={0} />
    </div>
  );
}
