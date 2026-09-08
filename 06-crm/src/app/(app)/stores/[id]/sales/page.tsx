import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { dateTime, rub } from "@/lib/format";
import { dayRange } from "@/lib/excel-csv";
import { DeletedMark } from "@/components/deleted-mark";

export default async function SalesHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; from?: string; to?: string; deleted?: string }>;
}) {
  const { id: storeId } = await params;
  const sp = await searchParams;
  const needle = (sp.q ?? "").trim();
  const showDeleted = sp.deleted === "1";
  const { from, to, fromYmd, toYmd } = dayRange(sp.from, sp.to);

  const aliasSerials = needle
    ? await prisma.changeLog.findMany({
        where: {
          storeId,
          OR: [{ serialOld: { contains: needle } }, { serialNew: { contains: needle } }],
        },
        select: { serialOld: true, serialNew: true, saleId: true },
        take: 50,
      })
    : [];

  const relatedSerials = new Set<string>();
  const relatedSaleIds = new Set<string>();
  for (const a of aliasSerials) {
    if (a.serialOld) relatedSerials.add(a.serialOld);
    if (a.serialNew) relatedSerials.add(a.serialNew);
    if (a.saleId) relatedSaleIds.add(a.saleId);
  }
  if (needle) relatedSerials.add(needle);

  const sales = await prisma.sale.findMany({
    where: {
      storeId,
      soldAt: { gte: from, lte: to },
      ...(showDeleted ? {} : { deletedAt: null }),
      ...(needle
        ? {
            OR: [
              { number: { contains: needle } },
              { note: { contains: needle } },
              { customer: { name: { contains: needle } } },
              { customer: { phone: { contains: needle } } },
              { lines: { some: { serial: { contains: needle } } } },
              { lines: { some: { name: { contains: needle } } } },
              ...(relatedSaleIds.size ? [{ id: { in: [...relatedSaleIds] } }] : []),
              ...(relatedSerials.size
                ? [{ lines: { some: { serial: { in: [...relatedSerials] } } } }]
                : []),
            ],
          }
        : {}),
    },
    include: {
      seller: true,
      customer: true,
      deletedBy: true,
      lines: true,
    },
    orderBy: { soldAt: "desc" },
    take: 200,
  });

  const recentChanges = await prisma.changeLog.findMany({
    where: {
      storeId,
      OR: [{ entityType: "sale" }, { entityType: "sale_line" }, { saleId: { not: null } }],
      createdAt: { gte: from, lte: to },
    },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/stores/${storeId}/pos`}
              className="border border-border px-3 py-1.5 font-mono text-[10px] uppercase text-muted-foreground"
            >
              Касса
            </Link>
            <span className="bg-foreground px-3 py-1.5 font-mono text-[10px] uppercase text-background">
              История чеков
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Поиск по IMEI, номеру чека, клиенту. Удалённые — галка «Удалённые».
          </p>
        </div>
      </div>

      <form className="flex flex-wrap gap-2">
        <input type="date" name="from" defaultValue={fromYmd} className="h-9 border border-input bg-background px-2 text-sm" />
        <input type="date" name="to" defaultValue={toYmd} className="h-9 border border-input bg-background px-2 text-sm" />
        <input
          name="q"
          defaultValue={needle}
          placeholder="IMEI / чек / клиент…"
          className="h-9 w-56 border border-input bg-background px-2 text-sm"
        />
        <label className="flex h-9 items-center gap-2 border border-border px-2 text-xs">
          <input type="checkbox" name="deleted" value="1" defaultChecked={showDeleted} />
          Удалённые
        </label>
        <button type="submit" className="h-9 border border-border px-3 font-mono text-[10px] uppercase">
          Найти
        </button>
      </form>

      <section>
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Чеки</h2>
        <ul className="divide-y divide-border border border-border bg-card">
          {!sales.length ? (
            <li className="px-4 py-4 text-sm text-muted-foreground">Чеков не найдено</li>
          ) : null}
          {sales.map((s) => {
            const activeLines = s.lines.filter((l) => !l.deletedAt);
            const deletedLines = s.lines.filter((l) => l.deletedAt);
            return (
              <li
                key={s.id}
                className={`flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm ${
                  s.deletedAt ? "bg-red-50/50 opacity-80" : ""
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/stores/${storeId}/sales/${s.id}`} className="font-mono underline">
                      {s.number ?? s.id.slice(0, 8)}
                    </Link>
                    <DeletedMark at={s.deletedAt} who={s.deletedBy?.name} />
                    {deletedLines.length && !s.deletedAt ? (
                      <span className="font-mono text-[10px] text-red-600">
                        × позиций: {deletedLines.length}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dateTime(s.soldAt)} · продавец {s.seller?.name ?? "—"} · {s.customer?.name ?? "розница"}
                  </p>
                  <p className={`mt-1 text-xs ${s.deletedAt ? "line-through text-muted-foreground" : ""}`}>
                    {(s.deletedAt ? s.lines : activeLines)
                      .map((l) => `${l.name}${l.serial ? ` (${l.serial})` : ""}${l.deletedAt ? " ×" : ""}`)
                      .join(", ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-mono ${s.deletedAt ? "line-through text-red-600" : ""}`}>{rub(s.amount)}</p>
                  <Link href={`/stores/${storeId}/sales/${s.id}`} className="text-xs underline">
                    Открыть
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Журнал изменений (продажи)
        </h2>
        <ul className="divide-y divide-border border border-border bg-card">
          {!recentChanges.length ? (
            <li className="px-4 py-4 text-sm text-muted-foreground">Записей за период нет</li>
          ) : null}
          {recentChanges.map((h) => (
            <li key={h.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p>{h.summary}</p>
                  {h.saleId ? (
                    <Link href={`/stores/${storeId}/sales/${h.saleId}`} className="text-xs underline">
                      к чеку
                    </Link>
                  ) : null}
                </div>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {dateTime(h.createdAt)} · {h.user?.name ?? "система"} · {h.action}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
