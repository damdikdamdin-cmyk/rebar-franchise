import { prisma } from "@/lib/prisma";
import type { CashTxnDirection } from "@prisma/client";

export async function ensureStoreCash(storeId: string) {
  const existing = await prisma.cashRegister.findFirst({
    where: { storeId, active: true },
  });
  if (existing) return existing;
  return prisma.cashRegister.create({
    data: { storeId, name: "Касса", balance: 0 },
  });
}

export async function ensureCashCategories() {
  const count = await prisma.cashCategory.count();
  if (count > 0) return;
  await prisma.cashCategory.createMany({
    data: [
      { name: "Продажа", direction: "in", system: true },
      { name: "Предоплата заказа", direction: "in", system: true },
      { name: "Оплата поставщику", direction: "out", system: true },
      { name: "Возврат клиенту", direction: "out", system: true },
      { name: "Выдача учредителю", direction: "out", system: false },
      { name: "Логистика", direction: "out", system: false },
      { name: "Прочий приход", direction: "in", system: false },
      { name: "Прочий расход", direction: "out", system: false },
    ],
  });
}

export async function postCashTxn(input: {
  registerId: string;
  direction: CashTxnDirection;
  amount: number;
  categoryName?: string;
  saleId?: string;
  stockDocId?: string;
  userId?: string | null;
  recipient?: string;
  note?: string;
  occurredAt?: Date;
}) {
  if (input.amount <= 0) throw new Error("Сумма должна быть больше 0");
  await ensureCashCategories();

  let categoryId: string | undefined;
  if (input.categoryName) {
    let cat = await prisma.cashCategory.findFirst({
      where: { name: input.categoryName, direction: input.direction },
    });
    if (!cat) {
      cat = await prisma.cashCategory.create({
        data: { name: input.categoryName, direction: input.direction, system: false },
      });
    }
    categoryId = cat.id;
  }

  return prisma.$transaction(async (tx) => {
    const register = await tx.cashRegister.findUniqueOrThrow({ where: { id: input.registerId } });
    const delta = input.direction === "in" ? input.amount : -input.amount;
    const balanceAfter = register.balance + delta;
    if (balanceAfter < 0) throw new Error("Недостаточно средств в кассе");

    await tx.cashRegister.update({
      where: { id: register.id },
      data: { balance: balanceAfter },
    });

    return tx.cashTxn.create({
      data: {
        registerId: register.id,
        categoryId,
        direction: input.direction,
        amount: input.amount,
        balanceAfter,
        saleId: input.saleId,
        stockDocId: input.stockDocId,
        userId: input.userId ?? undefined,
        recipient: input.recipient,
        note: input.note,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
  });
}
