import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Внутренние штрихкоды товаров — EAN-13 с префиксом 200 (диапазон «для внутреннего
 * использования», не пересекается с кодами производителей). Тело — 9 цифр из кода
 * товара; если код нечисловой — из порядкового номера. Последняя цифра — контрольная.
 */
export function ean13CheckDigit(body12: string) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(body12[i]);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return String((10 - (sum % 10)) % 10);
}

export function isValidEan13(code: string) {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === code[12];
}

export function internalBarcode(seed: string | number) {
  const digits = String(seed).replace(/\D/g, "");
  const body = ("200" + digits.padStart(9, "0").slice(-9)).slice(0, 12);
  return body + ean13CheckDigit(body);
}

/** Штрихкод для нового товара: из кода товара, при коллизии — из счётчика. */
export async function nextProductBarcode(tx: Prisma.TransactionClient | typeof prisma, code: string) {
  const fromCode = /\d/.test(code) ? internalBarcode(code) : null;
  if (fromCode) {
    const clash = await tx.product.findFirst({ where: { barcode: fromCode }, select: { id: true } });
    if (!clash) return fromCode;
  }
  const count = await tx.product.count();
  for (let i = 1; i < 50; i++) {
    const candidate = internalBarcode(900000000 + count + i);
    const clash = await tx.product.findFirst({ where: { barcode: candidate }, select: { id: true } });
    if (!clash) return candidate;
  }
  return internalBarcode(Date.now() % 1_000_000_000);
}

/** Присвоить штрихкоды всем товарам без них. Возвращает количество обновлённых. */
export async function backfillBarcodes() {
  const missing = await prisma.product.findMany({ where: { OR: [{ barcode: null }, { barcode: "" }] }, select: { id: true, code: true } });
  let n = 0;
  for (const p of missing) {
    const barcode = await nextProductBarcode(prisma, p.code);
    await prisma.product.update({ where: { id: p.id }, data: { barcode } });
    n++;
  }
  return n;
}
