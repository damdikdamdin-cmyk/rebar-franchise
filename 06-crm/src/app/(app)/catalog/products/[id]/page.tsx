import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canAccessRetail, canEditCatalog } from "@/lib/access";
import { upsertProduct, softDeleteProduct } from "@/actions/retail";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/fields";
import { PrintActions } from "@/components/print/print-actions";
import { SerialTrackedFields } from "@/components/serial-tracked-fields";
import { dateTime } from "@/lib/format";
import { DeletedMark } from "@/components/deleted-mark";

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canAccessRetail(user.role)) redirect("/");
  const canEdit = canEditCatalog(user.role);
  const { id } = await params;
  const isNew = id === "new";
  if (isNew && !canEdit) redirect("/catalog/products");
  const product = isNew
    ? null
    : await prisma.product.findUnique({
        where: { id },
        include: {
          balances: { include: { store: true } },
          serials: { include: { store: true }, orderBy: { createdAt: "desc" }, take: 40 },
        },
      });
  if (!isNew && !product) notFound();

  const groups = await prisma.productGroup.findMany({ orderBy: { name: "asc" } });
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  const stores = await prisma.store.findMany({ orderBy: { city: "asc" }, select: { id: true, city: true } });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/catalog/products" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          ← Товары
        </Link>
        <h1 className="mt-2 font-serif text-4xl">{isNew ? "Новый товар" : product!.name}</h1>
        {!isNew && product?.deletedAt ? (
          <div className="mt-2">
            <DeletedMark at={product.deletedAt} />
            <p className="mt-1 text-sm text-red-600">Номенклатура удалена — скрыта с остатков, история сохранена.</p>
          </div>
        ) : null}
        {!isNew && product ? (
          <div className="mt-3">
            <PrintActions
              label="Печать"
              actions={[
                { key: "big", label: "Большой ценник", href: `/print/price_big?product=${product.id}` },
                { key: "small", label: "Маленький ценник", href: `/print/price_small?product=${product.id}` },
                { key: "label", label: "Этикетка 43×25", href: `/print/label_43x25?product=${product.id}` },
                { key: "imei", label: "Этикетка IMEI", href: `/print/label_imei?product=${product.id}` },
              ]}
            />
            {product.barcode ? (
              <p className="mt-2 font-mono text-[10px] text-muted-foreground">Штрихкод: {product.barcode}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {!canEdit ? (
        <p className="rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">Только просмотр. Изменять каталог могут УК, партнёр и управляющий.</p>
      ) : null}

      <form action={upsertProduct} className={`space-y-4 border border-border bg-card p-5 ${canEdit ? "" : "pointer-events-none opacity-60"}`}>
        {!isNew ? <input type="hidden" name="id" value={product!.id} /> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Название</Label>
            <Input id="name" name="name" required defaultValue={product?.name ?? ""} />
          </div>
          <div>
            <Label htmlFor="code">Код</Label>
            <Input id="code" name="code" required defaultValue={product?.code ?? ""} />
          </div>
          <div>
            <Label htmlFor="barcode">Штрихкод</Label>
            <Input id="barcode" name="barcode" defaultValue={product?.barcode ?? ""} />
          </div>
          <div>
            <Label htmlFor="sku">Артикул</Label>
            <Input id="sku" name="sku" defaultValue={product?.sku ?? ""} />
          </div>
          <div>
            <Label htmlFor="groupId">Группа</Label>
            <select
              id="groupId"
              name="groupId"
              defaultValue={product?.groupId ?? "__none__"}
              className="flex h-9 w-full border border-input bg-background px-3 text-sm"
            >
              <option value="__none__">Без группы</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="supplierId">Поставщик</Label>
            <select
              id="supplierId"
              name="supplierId"
              defaultValue={product?.supplierId ?? "__none__"}
              className="flex h-9 w-full border border-input bg-background px-3 text-sm"
            >
              <option value="__none__">Не указан</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="purchasePrice">Закуп. цена</Label>
            <Input
              id="purchasePrice"
              name="purchasePrice"
              inputMode="numeric"
              defaultValue={product?.purchasePrice ? String(product.purchasePrice) : ""}
            />
          </div>
          <div>
            <Label htmlFor="retailPrice">Розничная</Label>
            <Input
              id="retailPrice"
              name="retailPrice"
              inputMode="numeric"
              defaultValue={product?.retailPrice ? String(product.retailPrice) : ""}
            />
          </div>
          <div>
            <Label htmlFor="repairPrice">Ремонтная</Label>
            <Input
              id="repairPrice"
              name="repairPrice"
              inputMode="numeric"
              defaultValue={product?.repairPrice ? String(product.repairPrice) : ""}
            />
          </div>
          <div>
            <Label htmlFor="preorderPrice">Под заказ</Label>
            <Input
              id="preorderPrice"
              name="preorderPrice"
              inputMode="numeric"
              defaultValue={product?.preorderPrice ? String(product.preorderPrice) : ""}
            />
          </div>
          <div>
            <Label htmlFor="warrantyDays">Гарантия, дней</Label>
            <Input
              id="warrantyDays"
              name="warrantyDays"
              inputMode="numeric"
              defaultValue={product?.warrantyDays != null ? String(product.warrantyDays) : "365"}
            />
          </div>
          <div>
            <Label htmlFor="minStock">Мин. остаток</Label>
            <Input
              id="minStock"
              name="minStock"
              inputMode="numeric"
              defaultValue={product?.minStock ? String(product.minStock) : ""}
            />
          </div>
          <div>
            <Label htmlFor="commissionPct">Комиссия %</Label>
            <Input
              id="commissionPct"
              name="commissionPct"
              inputMode="numeric"
              defaultValue={product?.commissionPct ? String(product.commissionPct) : ""}
            />
          </div>
          <div>
            <Label htmlFor="commissionRub">Комиссия ₽</Label>
            <Input
              id="commissionRub"
              name="commissionRub"
              inputMode="numeric"
              defaultValue={product?.commissionRub ? String(product.commissionRub) : ""}
            />
          </div>
        </div>
        <SerialTrackedFields
          defaultChecked={product?.serialTracked ?? false}
          stores={stores}
          existingSerials={(product?.serials ?? []).map((s) => ({
            serial: s.serial,
            status: s.status,
            storeCity: s.store.city,
          }))}
        />
        <div>
          <Label htmlFor="description">Описание</Label>
          <Textarea id="description" name="description" defaultValue={product?.description ?? ""} />
        </div>
        <Button type="submit">Сохранить</Button>
      </form>

      {!isNew && product && canEdit && !product.deletedAt ? (
        <section className="border border-red-200 bg-card p-4">
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-red-600">
            Удалить номенклатуру
          </h2>
          <form action={softDeleteProduct}>
            <input type="hidden" name="productId" value={product.id} />
            <button
              type="submit"
              className="h-9 border border-red-600 bg-red-600 px-4 font-mono text-[10px] uppercase text-white"
            >
              Удалить ×
            </button>
          </form>
        </section>
      ) : null}

      {product?.balances?.length ? (
        <section>
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Остатки по точкам</h2>
          <ul className="divide-y divide-border border border-border bg-card">
            {product.balances.map((b) => (
              <li key={b.id} className="flex justify-between px-4 py-2 text-sm">
                <span>{b.store.city}</span>
                <span className="font-mono">{b.qty}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!isNew && product ? <ProductHistory productId={product.id} serials={product.serials} /> : null}
    </div>
  );
}

async function ProductHistory({
  productId,
  serials,
}: {
  productId: string;
  serials: Array<{ id: string; serial: string; store: { city: string; id: string }; status: string }>;
}) {
  const history = await prisma.changeLog.findMany({
    where: {
      OR: [{ productId }, { serialId: { in: serials.map((s) => s.id) } }],
    },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <>
      {serials.length ? (
        <section>
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Устройства (S/N)
          </h2>
          <ul className="divide-y divide-border border border-border bg-card">
            {serials.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 px-4 py-2 text-sm">
                <span className="font-mono">{s.serial}</span>
                <span className="text-xs text-muted-foreground">
                  {s.store.city} · {s.status}{" "}
                  <Link href={`/stores/${s.store.id}/devices/${s.id}`} className="underline">
                    история
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          История номенклатуры
        </h2>
        <ul className="divide-y divide-border border border-border bg-card">
          {!history.length ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">Записей пока нет</li>
          ) : null}
          {history.map((h) => (
            <li key={h.id} className="px-4 py-3 text-sm">
              <p>{h.summary}</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {dateTime(h.createdAt)} · {h.user?.name ?? "система"} · {h.action}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
