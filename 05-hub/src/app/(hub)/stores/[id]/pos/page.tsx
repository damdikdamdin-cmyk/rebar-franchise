import { prisma } from "@/lib/prisma";
import { PosCheckout } from "@/components/pos-checkout";

export default async function PosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sold?: string }>;
}) {
  const { id } = await params;
  const { sold } = await searchParams;
  const products = await prisma.product.findMany({
    where: { active: true },
    include: { balances: true },
    orderBy: { name: "asc" },
  });

  const rows = products.map((p) => {
    const here = p.balances.find((b) => b.storeId === id)?.qty ?? 0;
    const other = p.balances.filter((b) => b.storeId !== id).reduce((s, b) => s + b.qty, 0);
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      retailPrice: p.retailPrice,
      serialTracked: p.serialTracked,
      qty: here,
      otherQty: other,
    };
  });

  return <PosCheckout storeId={id} products={rows} soldId={sold} />;
}
