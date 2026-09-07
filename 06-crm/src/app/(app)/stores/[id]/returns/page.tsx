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

export default async function ReturnsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [products, suppliers, docs] = await Promise.all([
    productOpts(id),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.stockDocument.findMany({
      where: { storeId: id, type: { in: ["customer_return", "supplier_return"] } },
      include: { supplier: true, user: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-8">
      <StockDocForm storeId={id} type="customer_return" products={products} title="Возврат от клиента" />
      <StockDocForm
        storeId={id}
        type="supplier_return"
        products={products.filter((p) => p.qty > 0)}
        suppliers={suppliers}
        title="Возврат поставщику"
      />
      <DocTable docs={docs} total={docs.reduce((s, d) => s + d.totalAmount, 0)} />
    </div>
  );
}
