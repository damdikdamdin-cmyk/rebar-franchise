import { prisma } from "@/lib/prisma";
import { ensureStoreCash, ensureCashCategories } from "@/lib/cash";
import { CashDeskPanel } from "@/components/cash-desk-panel";

export default async function CashPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureStoreCash(id);
  await ensureCashCategories();
  const registers = await prisma.cashRegister.findMany({
    where: { storeId: id, active: true },
    orderBy: { createdAt: "asc" },
  });
  const categories = await prisma.cashCategory.findMany({
    orderBy: [{ direction: "asc" }, { name: "asc" }],
  });

  return (
    <CashDeskPanel
      storeId={id}
      registers={registers.map((r) => ({ id: r.id, name: r.name, balance: r.balance }))}
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        direction: c.direction,
        system: c.system,
      }))}
    />
  );
}
