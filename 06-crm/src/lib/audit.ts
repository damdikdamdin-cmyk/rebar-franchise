import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ChangeLogInput = {
  storeId?: string | null;
  userId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  productId?: string | null;
  serialId?: string | null;
  serialOld?: string | null;
  serialNew?: string | null;
  saleId?: string | null;
  stockDocId?: string | null;
  meta?: Record<string, unknown> | null;
};

type Tx = Prisma.TransactionClient | typeof prisma;

export async function writeChangeLog(input: ChangeLogInput, tx: Tx = prisma) {
  return tx.changeLog.create({
    data: {
      storeId: input.storeId ?? null,
      userId: input.userId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      summary: input.summary,
      field: input.field ?? null,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      productId: input.productId ?? null,
      serialId: input.serialId ?? null,
      serialOld: input.serialOld ?? null,
      serialNew: input.serialNew ?? null,
      saleId: input.saleId ?? null,
      stockDocId: input.stockDocId ?? null,
      meta: input.meta ? JSON.stringify(input.meta) : null,
    },
  });
}
