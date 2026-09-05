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

export default async function ReceiptsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [products, suppliers, docs] = await Promise.all([
    productOpts(id),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.stockDocument.findMany({
      where: { storeId: id, type: "receipt" },
      include: { supplier: true, user: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const total = docs.reduce((s, d) => s + d.totalAmount, 0);

  return (
    <div className="space-y-6">
      <StockDocForm storeId={id} type="receipt" products={products} suppliers={suppliers} title="Новое поступление" />
      <DocTable docs={docs} total={total} />
    </div>
  );
}
