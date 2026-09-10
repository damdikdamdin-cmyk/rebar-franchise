import { prisma } from "@/lib/prisma";
import { InventoryWorkspace } from "@/components/inventory-workspace";
import { DocTable } from "@/components/doc-table";
import { dateTime, rub } from "@/lib/format";
import { getOpenInventory } from "@/lib/inventory-lock";
import Link from "next/link";

export default async function InventoriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { id } = await params;
  const { done } = await searchParams;

  const [balances, openInventory, docs] = await Promise.all([
    prisma.stockBalance.findMany({
      where: { storeId: id, qty: { gt: 0 }, product: { deletedAt: null, active: true } },
      include: {
        product: {
          include: {
            serials: {
              where: { storeId: id, status: "in_stock" },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
      orderBy: { product: { name: "asc" } },
    }),
    getOpenInventory(id),
    prisma.stockDocument.findMany({
      where: { storeId: id, type: "inventory", deletedAt: null, postedAt: { not: null } },
      include: {
        supplier: true,
        user: true,
        lines: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const rows = balances.flatMap((b) => {
    const p = b.product;
    if (p.serialTracked && p.serials.length) {
      return p.serials.map((s) => ({
        key: s.id,
        productId: p.id,
        name: p.name,
        code: p.code,
        qtyAccount: 1,
        purchasePrice: s.purchasePrice ?? p.purchasePrice,
        retailPrice: s.retailPrice ?? p.retailPrice,
        serial: s.serial,
        serialTracked: true,
      }));
    }
    return [
      {
        key: b.id,
        productId: p.id,
        name: p.name,
        code: p.code,
        qtyAccount: b.qty,
        purchasePrice: p.purchasePrice,
        retailPrice: p.retailPrice,
        serialTracked: p.serialTracked,
      },
    ];
  });

  const doneDoc = done ? docs.find((d) => d.id === done) : null;
  const doneMissing = doneDoc
    ? doneDoc.lines.filter((l) => l.qtyActual < l.qtyAccount)
    : [];

  return (
    <div className="space-y-8">
      <InventoryWorkspace
        storeId={id}
        rows={rows}
        doneId={done}
        openInventoryId={openInventory?.id ?? null}
      />

      {doneDoc ? (
        <section className="border border-border bg-card p-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Результат · {doneDoc.number}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{dateTime(doneDoc.createdAt)}</p>
          {!doneMissing.length ? (
            <p className="mt-3 text-sm">Расхождений нет — все отмеченные позиции совпали с учётом.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border border border-border">
              {doneMissing.map((l) => (
                <li key={l.id} className="flex justify-between gap-2 px-3 py-2 text-sm">
                  <span>
                    не хватает · учёт {l.qtyAccount} → факт {l.qtyActual}
                    {l.serial ? ` · ${l.serial}` : ""}
                  </span>
                  <span className="font-mono text-xs">
                    закуп {rub(l.price * (l.qtyAccount - l.qtyActual))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            История инвентаризаций
          </h2>
          <Link href={`/stores/${id}/stock`} className="font-mono text-[10px] uppercase underline">
            Остатки
          </Link>
        </div>
        <DocTable docs={docs} total={docs.length} />
      </section>
    </div>
  );
}
