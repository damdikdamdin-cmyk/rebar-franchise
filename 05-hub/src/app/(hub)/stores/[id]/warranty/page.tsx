import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { assertStoreAccess } from "@/lib/access";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/fields";
import { dateTime, rub, shortDate } from "@/lib/format";
import { warrantyLabel, warrantyUntil } from "@/lib/print/context";
import { PrintActions } from "@/components/print/print-actions";

function remainingDays(until: Date) {
  return Math.ceil((until.getTime() - Date.now()) / 86400000);
}

function remainingLabel(days: number) {
  if (days < 0) return { text: "истекла", tone: "warn" as const };
  if (days === 0) return { text: "сегодня", tone: "warn" as const };
  if (days < 30) return { text: `${days} дн.`, tone: "warn" as const };
  if (days < 365) {
    const m = Math.floor(days / 30);
    return { text: `~${m} мес.`, tone: "steel" as const };
  }
  const y = Math.floor(days / 365);
  const m = Math.floor((days % 365) / 30);
  return { text: m ? `${y} г. ${m} мес.` : `${y} г.`, tone: "open" as const };
}

export default async function WarrantyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  const user = await requireUser();
  const store = await prisma.store.findUnique({ where: { id } });
  if (!store || !assertStoreAccess(user, store)) redirect("/");

  const query = q?.trim() ?? "";
  const lines = await prisma.saleLine.findMany({
    where: {
      sale: { storeId: id },
      OR: query
        ? [
            { serial: { contains: query } },
            { name: { contains: query } },
            { sale: { number: { contains: query } } },
            { sale: { customer: { phone: { contains: query } } } },
            { sale: { customer: { name: { contains: query } } } },
            { product: { code: { contains: query } } },
            { product: { barcode: { contains: query } } },
          ]
        : undefined,
    },
    include: {
      product: true,
      sale: { include: { customer: true, seller: true } },
    },
    orderBy: { sale: { soldAt: "desc" } },
    take: query ? 100 : 50,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl">Проданные устройства</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Остаток гарантии считается от даты продажи и срока, зафиксированного в чеке.
          </p>
        </div>
      </div>

      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="IMEI, телефон, чек, код…"
          data-barcode-input="1"
          className="h-9 min-w-[240px] flex-1 border border-border bg-background px-3 text-sm"
        />
        <button type="submit" className="border border-border bg-foreground px-4 py-2 font-mono text-[10px] uppercase text-background">
          Найти
        </button>
      </form>

      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3">Продажа</th>
              <th className="px-4 py-3">Устройство</th>
              <th className="px-4 py-3">IMEI / S/N</th>
              <th className="px-4 py-3">Клиент</th>
              <th className="px-4 py-3">Гарантия</th>
              <th className="px-4 py-3">Остаток</th>
              <th className="px-4 py-3">Печать</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const days = l.warrantyDays ?? l.product?.warrantyDays ?? null;
              const until = days ? warrantyUntil(l.sale.soldAt, days) : null;
              const left = until ? remainingDays(until) : null;
              const rem = left !== null ? remainingLabel(left) : null;
              return (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs">{l.sale.number ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{dateTime(l.sale.soldAt)}</div>
                    <div className="text-xs text-muted-foreground">{l.sale.seller?.name ?? ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    {l.productId ? (
                      <Link href={`/catalog/products/${l.productId}`} className="hover:underline">
                        {l.name}
                      </Link>
                    ) : (
                      l.name
                    )}
                    <div className="font-mono text-[10px] text-muted-foreground">{rub(l.lineTotal)}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{l.serial ?? "—"}</td>
                  <td className="px-4 py-3">
                    {l.sale.customer ? (
                      <>
                        <div>{l.sale.customer.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{l.sale.customer.phone}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div>{warrantyLabel(days)}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{until ? `до ${shortDate(until)}` : "—"}</div>
                  </td>
                  <td className="px-4 py-3">
                    {rem ? <Badge tone={rem.tone}>{rem.text}</Badge> : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <PrintActions
                      actions={[
                        { key: "w", label: "Гарантийный талон", href: `/print/warranty?sale=${l.saleId}&store=${id}` },
                        { key: "r", label: "Товарный чек", href: `/print/receipt?sale=${l.saleId}&store=${id}` },
                        ...(l.sale.customerId
                          ? [
                              { key: "a", label: "Акт приёма", href: `/print/act_accept?customer=${l.sale.customerId}&line=${l.id}&store=${id}` },
                              { key: "c", label: "Согласие на диагностику", href: `/print/consent_diag?customer=${l.sale.customerId}&line=${l.id}&store=${id}` },
                            ]
                          : []),
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
            {!lines.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {query ? "Ничего не найдено" : "Пока нет продаж с позициями"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
