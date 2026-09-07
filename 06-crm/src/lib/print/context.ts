import { prisma } from "@/lib/prisma";
import type { PrintContext } from "./render";
import { rubInWords } from "./words";

const num = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n));
const date = (d: Date) => d.toLocaleDateString("ru-RU");
const dateTime = (d: Date) => d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function warrantyLabel(days: number | null | undefined) {
  if (!days) return "—";
  if (days % 365 === 0) return `${days / 365} ${days / 365 === 1 ? "год" : days / 365 < 5 ? "года" : "лет"}`;
  if (days % 30 === 0) return `${days / 30} мес.`;
  return `${days} дн.`;
}

export function warrantyUntil(soldAt: Date, days: number | null | undefined) {
  const d = new Date(soldAt);
  d.setDate(d.getDate() + (days ?? 0));
  return d;
}

type StoreLike = {
  name: string;
  city: string;
  address: string | null;
  phone: string | null;
  legalName: string | null;
  inn: string | null;
  ogrn: string | null;
  legalAddress: string | null;
};

function companyVars(store: StoreLike | null): Record<string, string> {
  return {
    НазваниеКомпании: store?.legalName ?? process.env.COMPANY_NAME ?? "",
    ИНН: store?.inn ?? process.env.COMPANY_INN ?? "",
    ОГРН: store?.ogrn ?? process.env.COMPANY_OGRN ?? "",
    ЮрАдрес: store?.legalAddress ?? process.env.COMPANY_ADDRESS ?? "",
    НазваниеЛокации: store ? `re:bar ${store.name}` : "re:bar",
    АдресЛокации: store?.address ?? "",
    ТелефонЛокации: store?.phone ?? "",
    Город: store?.city ?? "",
    Влт: "₽",
    ТекущаяДата: date(new Date()),
  };
}

export async function saleContext(saleId: string): Promise<PrintContext | null> {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { store: true, customer: true, seller: true, lines: { include: { product: { include: { group: true } } } } },
  });
  if (!sale) return null;
  const first = sale.lines[0];
  const firstDays = first?.warrantyDays ?? first?.product?.warrantyDays ?? null;
  const lines = sale.lines.map((l) => {
    const days = l.warrantyDays ?? l.product?.warrantyDays ?? null;
    return {
      Код: l.product?.code ?? "",
      Наименование: l.name,
      SN: l.serial ?? "",
      Кол: String(l.qty),
      Ед: l.product?.unit ?? "шт",
      Цена: num(l.unitPrice),
      СкидкаСтроки: num(l.unitPrice * l.qty - l.lineTotal),
      Сумма: num(l.lineTotal),
      ГарантДо: days ? date(warrantyUntil(sale.soldAt, days)) : "—",
      ГарантСрок: warrantyLabel(days),
      ШтрихкодСтроки: l.product?.barcode ?? "",
    };
  });
  return {
    doc: {
      ...companyVars(sale.store),
      НомерДокумента: sale.number ?? sale.id.slice(-6).toUpperCase(),
      ДатаВыдачи: date(sale.soldAt),
      ДатаВремя: dateTime(sale.soldAt),
      Комментарий: sale.note ?? "",
      СпособОплаты: sale.creditAmount > 0 ? (sale.creditAmount >= sale.amount ? "Кредит (Lendo)" : "Частично кредит (Lendo)") : "Наличные / карта",
      Контрагент: sale.customer?.name ?? "Розничный покупатель",
      ТелефонКонтрагента: sale.customer?.phone ?? "",
      Марка: first?.product?.group?.name ?? "",
      Модель: first?.name ?? "",
      IMEI: first?.serial ?? "",
      Гарант: warrantyLabel(firstDays),
      ГарантДо: firstDays ? date(warrantyUntil(sale.soldAt, firstDays)) : "—",
      Сотрудник: sale.seller?.name ?? "",
      ТелефонСотрудника: sale.seller?.email ?? "",
      Итого: num(sale.amount),
      ИтогоБезСкидки: num(sale.amount + sale.discountTotal),
      Скидка: num(sale.discountTotal),
      Кредит: num(sale.creditAmount),
      Оплачено: num(sale.amount - sale.creditAmount),
      ИтогоПрописью: rubInWords(sale.amount),
      КолПозиций: String(sale.lines.reduce((s, l) => s + l.qty, 0)),
    },
    lines,
    barcodes: { Штрихкод: sale.number ?? sale.id, ШтрихкодIMEI: first?.serial ?? "", QR: sale.store.phone ?? sale.number ?? "" },
  };
}

export async function productContext(productId: string, storeId: string | null, serial?: string | null): Promise<PrintContext | null> {
  const [product, store] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId }, include: { group: true, balances: storeId ? { where: { storeId } } : false } }),
    storeId ? prisma.store.findUnique({ where: { id: storeId } }) : null,
  ]);
  if (!product) return null;
  const qty = storeId ? (product.balances as Array<{ qty: number }>)[0]?.qty ?? 0 : 0;
  return {
    doc: {
      ...companyVars(store),
      Наименование: product.name,
      Модель: product.name,
      Марка: product.group?.name ?? "",
      КодТовара: product.code,
      Артикул: product.sku ?? "",
      Группа: product.group?.name ?? "",
      Розничная: num(product.retailPrice),
      Закупочная: num(product.purchasePrice),
      Ремонтная: num(product.repairPrice),
      ПодЗаказ: num(product.preorderPrice),
      Остаток: String(qty),
      IMEI: serial ?? "",
      Гарант: warrantyLabel(product.warrantyDays),
      ГарантДо: date(warrantyUntil(new Date(), product.warrantyDays)),
      Сотрудник: "",
      ДатаВыдачи: date(new Date()),
      НомерДокумента: product.code,
    },
    lines: [],
    barcodes: { ШтрихкодКод: product.barcode ?? "", ШтрихкодIMEI: serial ?? "", Штрихкод: product.barcode ?? product.code, QR: product.barcode ?? product.code },
  };
}

export async function stockDocContext(documentId: string): Promise<PrintContext | null> {
  const doc = await prisma.stockDocument.findUnique({
    where: { id: documentId },
    include: { store: true, toStore: true, supplier: true, user: true, lines: { include: { product: true } } },
  });
  if (!doc) return null;
  const lines = doc.lines.map((l) => ({
    Код: l.product.code,
    Наименование: l.product.name,
    SN: l.serial ?? "",
    Кол: String(l.qty),
    Ед: l.product.unit,
    Цена: num(l.price),
    СкидкаСтроки: "0",
    Сумма: num(l.price * l.qty),
    ГарантДо: "",
    ГарантСрок: "",
    ШтрихкодСтроки: l.product.barcode ?? "",
  }));
  return {
    doc: {
      ...companyVars(doc.store),
      НомерДокумента: doc.number,
      ДатаВыдачи: date(doc.postedAt ?? doc.createdAt),
      ДатаВремя: dateTime(doc.postedAt ?? doc.createdAt),
      Комментарий: doc.comment ?? "",
      Поставщик: doc.supplier?.name ?? doc.toStore?.name ?? "",
      Контрагент: doc.supplier?.name ?? doc.toStore?.name ?? "",
      Сотрудник: doc.user?.name ?? "",
      Итого: num(doc.totalAmount),
      Оплачено: num(doc.paidAmount),
      ИтогоПрописью: rubInWords(doc.totalAmount),
      КолПозиций: String(doc.lines.reduce((s, l) => s + l.qty, 0)),
    },
    lines,
    barcodes: { Штрихкод: doc.number, QR: doc.number },
  };
}

/** Акты, согласия, договоры: клиент (+ устройство из последней покупки, если есть) */
export async function customerContext(customerId: string, storeId: string | null, saleLineId?: string | null): Promise<PrintContext | null> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, include: { store: true } });
  if (!customer) return null;
  const line = saleLineId
    ? await prisma.saleLine.findUnique({ where: { id: saleLineId }, include: { sale: true, product: { include: { group: true } } } })
    : await prisma.saleLine.findFirst({ where: { sale: { customerId } }, orderBy: { sale: { soldAt: "desc" } }, include: { sale: true, product: { include: { group: true } } } });
  const store = storeId ? await prisma.store.findUnique({ where: { id: storeId } }) : customer.store;
  const days = line?.warrantyDays ?? line?.product?.warrantyDays ?? null;
  return {
    doc: {
      ...companyVars(store),
      НомерДокумента: line?.sale.number ?? "",
      ДатаВыдачи: date(new Date()),
      ДатаВремя: dateTime(new Date()),
      Контрагент: customer.name,
      ТелефонКонтрагента: customer.phone,
      ПаспортКонтрагента: "серия ______ № ____________",
      АдресКонтрагента: "________________________________",
      Марка: line?.product?.group?.name ?? "",
      Модель: line?.name ?? "",
      IMEI: line?.serial ?? "",
      Гарант: warrantyLabel(days),
      ГарантДо: line && days ? date(warrantyUntil(line.sale.soldAt, days)) : "",
      Комплектность: "________________________________",
      Неисправность: "________________________________",
      Сотрудник: "",
      Итого: line ? num(line.lineTotal) : "",
      ИтогоПрописью: line ? rubInWords(line.lineTotal) : "",
    },
    lines: [],
    barcodes: { Штрихкод: line?.sale.number ?? "", ШтрихкодIMEI: line?.serial ?? "", QR: store?.phone ?? "" },
  };
}

export async function freeContext(storeId: string | null): Promise<PrintContext> {
  const store = storeId ? await prisma.store.findUnique({ where: { id: storeId } }) : null;
  return {
    doc: {
      ...companyVars(store),
      НомерДокумента: "",
      ДатаВыдачи: date(new Date()),
      ДатаВремя: dateTime(new Date()),
      Контрагент: "________________________________",
      ТелефонКонтрагента: "________________",
      ПаспортКонтрагента: "серия ______ № ____________",
      АдресКонтрагента: "________________________________",
      Марка: "____________",
      Модель: "________________________",
      IMEI: "________________",
      Комплектность: "________________________________",
      Неисправность: "________________________________",
      Сотрудник: "",
    },
    lines: [],
    barcodes: { QR: store?.phone ?? "" },
  };
}
