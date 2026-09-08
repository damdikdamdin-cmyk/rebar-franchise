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
  const defaults = [
    { name: "Продажа", direction: "in" as const, system: true },
    { name: "Предоплата заказа", direction: "in" as const, system: true },
    { name: "Оплата поставщику", direction: "out" as const, system: true },
    { name: "Возврат клиенту", direction: "out" as const, system: true },
    { name: "Инкассация на закупки", direction: "out" as const, system: true },
    { name: "Инкассация на баланс поставщика", direction: "out" as const, system: true },
    { name: "Перемещение между кассами", direction: "out" as const, system: true },
      { name: "Перемещение между кассами", direction: "in" as const, system: true },
      { name: "Зарплата", direction: "out" as const, system: true },
      { name: "Выдача учредителю", direction: "out" as const, system: false },
    { name: "Логистика", direction: "out" as const, system: false },
    { name: "Прочий приход", direction: "in" as const, system: false },
    { name: "Прочий расход", direction: "out" as const, system: false },
  ];
  for (const d of defaults) {
    const exists = await prisma.cashCategory.findFirst({
      where: { name: d.name, direction: d.direction },
    });
    if (!exists) {
      await prisma.cashCategory.create({ data: d });
    }
  }
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
