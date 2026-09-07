import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { dateTime, rub } from "@/lib/format";
import { Badge } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/fields";
import { updateDevice } from "@/actions/retail";

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ id: string; serialId: string }>;
}) {
  const { id: storeId, serialId } = await params;
  const device = await prisma.productSerial.findUnique({
    where: { id: serialId },
    include: { product: true, store: true },
  });
  if (!device || device.storeId !== storeId) notFound();

  const history = await prisma.changeLog.findMany({
    where: {
      OR: [
        { serialId: device.id },
        { productId: device.productId, storeId },
        { serialOld: device.serial },
        { serialNew: device.serial },
      ],
    },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const sales = await prisma.saleLine.findMany({
    where: { serial: device.serial, sale: { storeId } },
    include: { sale: { include: { seller: true, customer: true } } },
    orderBy: { sale: { soldAt: "desc" } },
    take: 20,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/stores/${storeId}/devices`}
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
        >
          ← Устройства
        </Link>
        <h1 className="mt-2 font-serif text-3xl">{device.product.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm">IMEI {device.serial}</span>
          <Badge tone={device.status === "in_stock" ? "success" : "steel"}>{device.status}</Badge>
        </div>
      </div>

      <section className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Закуп</p>
          <p className="font-mono text-lg">{rub(device.purchasePrice ?? device.product.purchasePrice)}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Розница</p>
          <p className="font-mono text-lg">{rub(device.retailPrice ?? device.product.retailPrice)}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Гарантия</p>
          <p className="font-mono text-lg">{device.warrantyDays ?? device.product.warrantyDays} дн.</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Создан</p>
          <p className="text-sm">{dateTime(device.createdAt)}</p>
        </div>
      </section>

      <section className="border border-border bg-card p-4">
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Редактировать устройство
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Смена IMEI, гарантии, цен и справок пишется в журнал. Старый IMEI остаётся в истории и находится поиском.
        </p>
        <form action={updateDevice} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="storeId" value={storeId} />
          <input type="hidden" name="serialId" value={device.id} />
          <div className="sm:col-span-2">
            <Label>Название модели</Label>
            <Input name="name" defaultValue={device.product.name} />
          </div>
          <div>
            <Label>IMEI / S/N</Label>
            <Input name="serial" defaultValue={device.serial} />
          </div>
          <div>
            <Label>Гарантия, дней</Label>
            <Input
              name="warrantyDays"
              type="number"
              defaultValue={device.warrantyDays ?? device.product.warrantyDays}
            />
          </div>
          <div>
            <Label>Закуп</Label>
            <Input
              name="purchasePrice"
              type="number"
              defaultValue={device.purchasePrice ?? device.product.purchasePrice}
            />
          </div>
          <div>
            <Label>Розница</Label>
            <Input
              name="retailPrice"
              type="number"
              defaultValue={device.retailPrice ?? device.product.retailPrice}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Справка / заметка</Label>
            <Textarea name="note" defaultValue={device.note ?? ""} rows={3} />
          </div>
          <Button type="submit" className="sm:col-span-2">
            Сохранить изменения
          </Button>
        </form>
      </section>

      {sales.length ? (
        <section>
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Продажи / чеки</h2>
          <ul className="divide-y divide-border border border-border bg-card">
            {sales.map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-mono">{l.sale.number ?? l.sale.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateTime(l.sale.soldAt)} · {l.sale.seller?.name ?? "—"} · {l.sale.customer?.name ?? "розница"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono">{rub(l.lineTotal)}</p>
                  <div className="flex gap-2 text-xs">
                    <Link href={`/print/receipt?sale=${l.sale.id}&store=${storeId}`} className="underline">
                      Чек
                    </Link>
                    <Link href={`/stores/${storeId}/reports?from=&to=`} className="underline">
                      Отчёты
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          История изменений
        </h2>
        <ul className="divide-y divide-border border border-border bg-card">
          {!history.length ? (
            <li className="px-4 py-4 text-sm text-muted-foreground">Записей пока нет</li>
          ) : null}
          {history.map((h) => (
            <li key={h.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p>{h.summary}</p>
                  {h.field ? (
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {h.field}: {h.oldValue ?? "—"} → {h.newValue ?? "—"}
                    </p>
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
