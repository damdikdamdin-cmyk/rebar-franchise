import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { dateTime, rub } from "@/lib/format";
import { dayRange } from "@/lib/excel-csv";
import { ExcelExportButton } from "@/components/excel-export-button";
import { DeletedMark } from "@/components/deleted-mark";

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; q?: string; deleted?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { from, to, fromYmd, toYmd } = dayRange(sp.from, sp.to);
  const needle = (sp.q ?? "").trim();
  const showDeleted = sp.deleted === "1";

  const aliasSerials = needle
    ? (
        await prisma.changeLog.findMany({
          where: {
            storeId: id,
            OR: [{ serialOld: { contains: needle } }, { serialNew: { contains: needle } }],
          },
          select: { serialOld: true, serialNew: true, saleId: true },
          take: 50,
        })
      )
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
      storeId: id,
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
    include: { seller: true, lines: true, customer: true, deletedBy: true },
    orderBy: { soldAt: "desc" },
  });

  const revenue = sales.reduce((s, x) => s + (x.deletedAt ? 0 : x.amount), 0);
  const cost = sales.reduce(
    (s, sale) =>
      s +
      (sale.deletedAt
        ? 0
        : sale.lines
            .filter((l) => !l.deletedAt)
            .reduce((a, l) => a + (l.costPrice || 0) * l.qty, 0)),
    0,
  );
  const profit = revenue - cost;
  const byProduct = new Map<
    string,
    { name: string; qty: number; amount: number; cost: number; profit: number }
  >();
  for (const sale of sales) {
    if (sale.deletedAt) continue;
    for (const line of sale.lines) {
      if (line.deletedAt) continue;
      const key = line.productId ?? line.name;
      const row = byProduct.get(key) ?? { name: line.name, qty: 0, amount: 0, cost: 0, profit: 0 };
      const lineCost = (line.costPrice || 0) * line.qty;
      row.qty += line.qty;
      row.amount += line.lineTotal;
      row.cost += lineCost;
      row.profit += line.lineTotal - lineCost;
      byProduct.set(key, row);
    }
  }

  const exportRows = sales.flatMap((s) =>
    s.lines.map((l) => [
      s.number ?? s.id.slice(0, 8),
      dateTime(s.soldAt),
      s.customer?.name ?? "розница",
      s.seller?.name ?? "",
      l.name,
      l.serial ?? "",
      l.qty,
      l.costPrice,
      l.unitPrice,
      l.lineTotal,
      l.lineTotal - (l.costPrice || 0) * l.qty,
      s.deletedAt || l.deletedAt ? "удалено" : "",
    ]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form className="flex flex-wrap gap-2">
          <input type="date" name="from" defaultValue={fromYmd} className="h-9 border border-input bg-background px-2 text-sm" />
          <input type="date" name="to" defaultValue={toYmd} className="h-9 border border-input bg-background px-2 text-sm" />
          <input
            name="q"
            defaultValue={needle}
            placeholder="IMEI / старый IMEI / чек…"
            className="h-9 w-56 border border-input bg-background px-2 text-sm"
          />
          <label className="flex h-9 items-center gap-2 border border-border px-2 text-xs">
            <input type="checkbox" name="deleted" value="1" defaultChecked={showDeleted} />
            Удалённые
          </label>
          <button type="submit" className="h-9 border border-border px-3 font-mono text-[11px] uppercase">
            Построить отчёт
          </button>
        </form>
        <ExcelExportButton
          filename={`report-${fromYmd}_${toYmd}.csv`}
          headers={[
            "Чек",
            "Дата",
            "Клиент",
            "Продавец",
            "Товар",
            "S/N",
            "Кол-во",
            "Себестоимость",
            "Розница",
            "Сумма",
            "Прибыль",
            "Статус",
          ]}
          rows={exportRows}
        />
      </div>

      {needle && aliasSerials.length ? (
        <section className="border border-border bg-card p-4 text-sm">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Совпадения в истории IMEI
          </h3>
          <ul className="mt-2 space-y-1">
            {aliasSerials.slice(0, 8).map((a, i) => (
              <li key={`${a.serialOld}-${a.serialNew}-${i}`} className="font-mono text-xs text-muted-foreground">
                {a.serialOld} → {a.serialNew}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card px-4 py-5">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Выручка</p>
          <p className="mt-1 font-mono text-xl">{rub(revenue)}</p>
        </div>
        <div className="bg-card px-4 py-5">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Себестоимость</p>
          <p className="mt-1 font-mono text-xl">{rub(cost)}</p>
        </div>
        <div className="bg-card px-4 py-5">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Прибыль</p>
          <p className="mt-1 font-mono text-xl">{rub(profit)}</p>
        </div>
        <div className="bg-card px-4 py-5">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Чеки</p>
          <p className="mt-1 font-mono text-xl">{sales.length}</p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            ср. чек {rub(sales.length ? revenue / sales.length : 0)}
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Товары</h2>
        <ul className="divide-y divide-border border border-border bg-card">
          {!byProduct.size ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">За период продаж нет.</li>
          ) : null}
          {[...byProduct.values()]
            .sort((a, b) => b.amount - a.amount)
            .map((r) => (
              <li key={r.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                <span>
                  {r.name} × {r.qty}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  закуп {rub(r.cost)} · розн {rub(r.amount)} · прибыль {rub(r.profit)}
                </span>
              </li>
            ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Чеки</h2>
        <ul className="divide-y divide-border border border-border bg-card">
          {!sales.length ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">Чеков за выбранные даты нет.</li>
          ) : null}
          {sales.map((s) => {
            const saleCost = s.lines
              .filter((l) => !l.deletedAt)
              .reduce((a, l) => a + (l.costPrice || 0) * l.qty, 0);
            return (
              <li
                key={s.id}
                className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm ${
                  s.deletedAt ? "bg-red-50/50" : ""
                }`}
              >
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-mono">
                    <Link href={`/stores/${id}/sales/${s.id}`} className="underline">
                      {s.number ?? s.id.slice(0, 8)}
                    </Link>
                    <DeletedMark at={s.deletedAt} who={s.deletedBy?.name} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dateTime(s.soldAt)} · {s.seller?.name ?? "—"} · {s.customer?.name ?? "розница"}
                  </p>
                  <p className={`mt-1 text-xs ${s.deletedAt ? "line-through text-muted-foreground" : ""}`}>
                    {s.lines
                      .map((l) => `${l.name}${l.serial ? ` (${l.serial})` : ""}${l.deletedAt ? " ×" : ""}`)
                      .join(", ")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`font-mono ${s.deletedAt ? "line-through text-red-600" : ""}`}>
                    {rub(s.amount)}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    прибыль {rub(s.deletedAt ? 0 : s.amount - saleCost)}
                  </span>
                  <div className="flex gap-3">
                    <Link href={`/stores/${id}/sales/${s.id}`} className="underline">
                      История
                    </Link>
                    <Link href={`/print/receipt?sale=${s.id}&store=${id}`} className="underline">
                      Чек
                    </Link>
                    <Link href={`/print/warranty?sale=${s.id}&store=${id}`} className="underline">
                      Гарантия
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
