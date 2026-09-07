import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { dateTime, rub } from "@/lib/format";
import { Badge } from "@/components/ui/fields";

export default async function DevicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  const needle = (q ?? "").trim();

  const serials = await prisma.productSerial.findMany({
    where: {
      storeId: id,
      ...(needle
        ? {
            OR: [
              { serial: { contains: needle } },
              { product: { name: { contains: needle } } },
              { product: { code: { contains: needle } } },
            ],
          }
        : {}),
    },
    include: { product: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  // Также ищем старые IMEI в журнале
  const oldHits = needle
    ? await prisma.changeLog.findMany({
        where: {
          storeId: id,
          OR: [{ serialOld: { contains: needle } }, { serialNew: { contains: needle } }],
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: true },
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Устройства</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Карточка S/N · история поступления, продаж, правок и смены IMEI
          </p>
        </div>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="IMEI / модель / старый IMEI…"
            className="h-9 w-72 border border-input bg-background px-3 text-sm"
          />
          <button type="submit" className="h-9 border border-border px-3 font-mono text-[10px] uppercase">
            Найти
          </button>
        </form>
      </div>

      {oldHits.length ? (
        <section className="border border-border bg-card p-4">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Найдено в истории IMEI
          </h3>
          <ul className="mt-2 space-y-2 text-sm">
            {oldHits.map((h) => (
              <li key={h.id} className="border-b border-border pb-2">
                <p>{h.summary}</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {dateTime(h.createdAt)} · {h.user?.name ?? "—"}
                  {h.serialId ? (
                    <>
                      {" · "}
                      <Link href={`/stores/${id}/devices/${h.serialId}`} className="underline">
                        открыть устройство
                      </Link>
                    </>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3">IMEI / S/N</th>
              <th className="px-4 py-3">Модель</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Закуп</th>
              <th className="px-4 py-3">Розница</th>
              <th className="px-4 py-3">Гарантия</th>
            </tr>
          </thead>
          <tbody>
            {!serials.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-muted-foreground">
                  Устройств не найдено
                </td>
              </tr>
            ) : null}
            {serials.map((s) => (
              <tr key={s.id} className="border-b border-border">
                <td className="px-4 py-3">
                  <Link href={`/stores/${id}/devices/${s.id}`} className="font-mono underline">
                    {s.serial}
                  </Link>
                </td>
                <td className="px-4 py-3">{s.product.name}</td>
                <td className="px-4 py-3">
                  <Badge tone={s.status === "in_stock" ? "success" : s.status === "sold" ? "steel" : "warn"}>
                    {s.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-mono">{rub(s.purchasePrice ?? s.product.purchasePrice)}</td>
                <td className="px-4 py-3 font-mono">{rub(s.retailPrice ?? s.product.retailPrice)}</td>
                <td className="px-4 py-3 font-mono">{s.warrantyDays ?? s.product.warrantyDays} дн.</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
