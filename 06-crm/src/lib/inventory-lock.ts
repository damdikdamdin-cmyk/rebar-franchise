import { prisma } from "@/lib/prisma";

/** Открытая инвентаризация точки (черновик, не проведён, не удалён). */
export async function getOpenInventory(storeId: string) {
  return prisma.stockDocument.findFirst({
    where: {
      storeId,
      type: "inventory",
      postedAt: null,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
}
