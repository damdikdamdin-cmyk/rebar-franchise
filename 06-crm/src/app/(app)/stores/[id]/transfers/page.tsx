import { prisma } from "@/lib/prisma";
import { StockDocForm } from "@/components/stock-doc-form";
import { DocTable } from "@/components/doc-table";

async function productOpts(storeId: string) {
  const products = await prisma.product.findMany({
    where: { active: true },
    include: { balances: { where: { storeId } } },
    orderBy: { name: "asc" },
  });
  return products.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    purchasePrice: p.purchasePrice,
    retailPrice: p.retailPrice,
    qty: p.balances[0]?.qty ?? 0,
  }));
}

export default async function TransfersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [products, stores, docs] = await Promise.all([
    productOpts(id),
    prisma.store.findMany({ where: { status: { not: "closed" } }, orderBy: { city: "asc" } }),
    prisma.stockDocument.findMany({
      where: { OR: [{ storeId: id, type: "transfer" }, { toStoreId: id, type: "transfer" }] },
      include: { supplier: true, user: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  return (
    <div className="space-y-6">
      <StockDocForm
        storeId={id}
        type="transfer"
        products={products.filter((p) => p.qty > 0)}
        stores={stores}
        title="Перемещение"
      />
      <DocTable docs={docs} total={docs.reduce((s, d) => s + d.totalAmount, 0)} />
    </div>
  );
}
