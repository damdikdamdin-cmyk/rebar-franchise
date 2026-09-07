import { prisma } from "@/lib/prisma";
import { IssueOrderButton, OrderCreateForm } from "@/components/order-forms";
import { Badge } from "@/components/ui/fields";
import { dateTime, rub } from "@/lib/format";

export default async function OrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, retailPrice: true, code: true },
  });
  const orders = await prisma.order.findMany({
    where: { storeId: id },
    include: { customer: true, lines: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <OrderCreateForm storeId={id} products={products} />
      <ul className="space-y-3">
        {orders.map((o) => (
          <li key={o.id} className="border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm">{o.number}</p>
                <p className="text-sm text-muted-foreground">
                  {o.customer?.name ?? "Без клиента"} · {dateTime(o.createdAt)}
                </p>
                <p className="mt-1 text-sm">
                  {o.lines.map((l) => `${l.name}×${l.qty}`).join(", ")}
                </p>
              </div>
              <div className="text-right">
                <Badge tone={o.status === "issued" ? "success" : "steel"}>{o.status}</Badge>
                <p className="mt-2 font-mono">{rub(o.totalAmount)}</p>
                {o.status === "reserved" ? <div className="mt-2"><IssueOrderButton storeId={id} orderId={o.id} /></div> : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
