import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { dateTime, rub } from "@/lib/format";
import { Badge } from "@/components/ui/fields";
import { DeletedMark } from "@/components/deleted-mark";
import { softDeleteSale, softDeleteSaleLine } from "@/actions/retail";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string; saleId: string }>;
}) {
  const { id: storeId, saleId } = await params;
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      seller: true,
      customer: true,
      deletedBy: true,
      lines: { include: { product: true }, orderBy: { id: "asc" } },
    },
  });
  if (!sale || sale.storeId !== storeId) notFound();

  const serials = sale.lines.map((l) => l.serial).filter(Boolean) as string[];
  const devices = serials.length
    ? await prisma.productSerial.findMany({
        where: { storeId, serial: { in: serials } },
        select: { id: true, serial: true, product: { select: { name: true } } },
      })
    : [];
  const deviceIds = devices.map((d) => d.id);

  const history = await prisma.changeLog.findMany({
    where: {
      OR: [
        { saleId: sale.id },
        ...(serials.length
          ? [{ serialOld: { in: serials } }, { serialNew: { in: serials } }]
          : []),
        ...(deviceIds.length ? [{ serialId: { in: deviceIds } }] : []),
      ],
    },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/stores/${storeId}/sales`}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
          >
            ← История чеков
          </Link>
          <Link
            href={`/stores/${storeId}/pos`}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
          >
            Касса
          </Link>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-3xl">Чек {sale.number ?? sale.id.slice(0, 8)}</h1>
          <DeletedMark at={sale.deletedAt} who={sale.deletedBy?.name} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {dateTime(sale.soldAt)} · продавец {sale.seller?.name ?? "—"} · {sale.customer?.name ?? "розница"}
        </p>
        {sale.deletedAt ? (
          <p className="mt-2 text-sm text-red-600">
            Чек удалён {dateTime(sale.deletedAt)}
            {sale.deletedBy ? ` · ${sale.deletedBy.name}` : ""}
            {sale.deletedReason ? ` · ${sale.deletedReason}` : ""}. Данные сохранены в истории.
          </p>
        ) : null}
      </div>

      <section className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-3">
        <div>
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Сумма</p>
          <p className={`font-mono text-lg ${sale.deletedAt ? "line-through text-red-600" : ""}`}>
            {rub(sale.amount)}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Lendo</p>
          <p className="font-mono text-lg">{rub(sale.creditAmount)}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Link href={`/print/receipt?sale=${sale.id}&store=${storeId}`} className="text-sm underline">
            Чек
          </Link>
          <Link href={`/print/warranty?sale=${sale.id}&store=${storeId}`} className="text-sm underline">
            Гарантия
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Позиции</h2>
        <ul className="divide-y divide-border border border-border bg-card">
          {sale.lines.map((l) => {
            const device = l.serial ? devices.find((d) => d.serial === l.serial) : null;
            const isGone = Boolean(l.deletedAt || sale.deletedAt);
            return (
              <li
                key={l.id}
                className={`flex flex-wrap justify-between gap-2 px-4 py-3 text-sm ${
                  isGone ? "bg-red-50/40" : ""
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={isGone ? "line-through text-muted-foreground" : ""}>{l.name}</p>
                    <DeletedMark at={l.deletedAt ?? sale.deletedAt} compact />
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {l.serial ? `IMEI ${l.serial}` : "без S/N"} · гарантия {l.warrantyDays ?? "—"} дн.
                  </p>
                  {device ? (
                    <Link href={`/stores/${storeId}/devices/${device.id}`} className="text-xs underline">
                      Карточка устройства
                    </Link>
                  ) : null}
                  {!sale.deletedAt && !l.deletedAt ? (
                    <form action={softDeleteSaleLine} className="mt-2">
                      <input type="hidden" name="storeId" value={storeId} />
                      <input type="hidden" name="lineId" value={l.id} />
                      <button type="submit" className="font-mono text-[10px] uppercase text-red-600 underline">
                        Удалить позицию ×
                      </button>
                    </form>
                  ) : null}
                </div>
                <div className={`text-right font-mono text-xs ${isGone ? "line-through text-red-600" : ""}`}>
                  <p>{rub(l.lineTotal)}</p>
                  <p className="text-muted-foreground">
                    закуп {rub(l.costPrice)} · розн {rub(l.unitPrice)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {!sale.deletedAt ? (
        <section className="border border-red-200 bg-card p-4">
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-red-600">
            Удалить чек
          </h2>
          <form action={softDeleteSale} className="flex flex-wrap gap-2">
            <input type="hidden" name="storeId" value={storeId} />
            <input type="hidden" name="saleId" value={sale.id} />
            <input
              name="reason"
              placeholder="Причина (необязательно)"
              className="h-9 min-w-[200px] flex-1 border border-input bg-background px-3 text-sm"
            />
            <button
              type="submit"
              className="h-9 border border-red-600 bg-red-600 px-4 font-mono text-[10px] uppercase text-white"
            >
              Удалить чек ×
            </button>
          </form>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          История правок (чек / устройства)
        </h2>
        <ul className="divide-y divide-border border border-border bg-card">
          {!history.length ? (
            <li className="px-4 py-4 text-sm text-muted-foreground">Правок не было — только создание продажи</li>
          ) : null}
          {history.map((h) => (
            <li key={h.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className={h.action === "soft_delete" ? "text-red-700" : ""}>{h.summary}</p>
                  {h.field ? (
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {h.field}: {h.oldValue ?? "—"} → {h.newValue ?? "—"}
                    </p>
                  ) : null}
                </div>
                <p className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  <span>
                    {dateTime(h.createdAt)} · {h.user?.name ?? "система"}
                  </span>
                  <Badge tone={h.action === "soft_delete" ? "warn" : "steel"}>{h.action}</Badge>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
