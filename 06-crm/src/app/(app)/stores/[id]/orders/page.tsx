import { prisma } from "@/lib/prisma";
import { OrderCreateForm, OrderHistory } from "@/components/order-forms";

export default async function OrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const products = await prisma.product.findMany({
    where: { active: true },
    include: { balances: true },
    orderBy: { name: "asc" },
  });
  const productOpts = products.map((p) => ({
    id: p.id,
    name: p.name,
    retailPrice: p.retailPrice,
    preorderPrice: p.preorderPrice,
    code: p.code,
    qty: p.balances.find((b) => b.storeId === id)?.qty ?? 0,
  }));

  const orders = await prisma.order.findMany({
    where: { storeId: id },
    include: { customer: true, lines: true },
    orderBy: { createdAt: "desc" },
    take: 120,
  });

  const history = orders.map((o) => ({
    id: o.id,
    number: o.number,
    kind: o.kind,
    status: o.status,
    totalAmount: o.totalAmount,
    prepaidAmount: o.prepaidAmount,
    comment: o.comment,
    dueAt: o.dueAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    customerName: o.customer?.name ?? null,
    customerPhone: o.customer?.phone ?? null,
    lines: o.lines.map((l) => ({ name: l.name, qty: l.qty })),
  }));

  return (
    <div className="space-y-8">
      <OrderCreateForm storeId={id} products={productOpts} />
      <OrderHistory storeId={id} orders={history} />
    </div>
  );
}
