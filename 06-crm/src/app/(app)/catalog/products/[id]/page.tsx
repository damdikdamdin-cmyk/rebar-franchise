import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canAccessRetail, canEditCatalog } from "@/lib/access";
import { upsertProduct } from "@/actions/retail";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/fields";
import { PrintActions } from "@/components/print/print-actions";

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canAccessRetail(user.role)) redirect("/");
  const canEdit = canEditCatalog(user.role);
  const { id } = await params;
  const isNew = id === "new";
  if (isNew && !canEdit) redirect("/catalog/products");
  const product = isNew
    ? null
    : await prisma.product.findUnique({ where: { id }, include: { balances: { include: { store: true } } } });
  if (!isNew && !product) notFound();

  const groups = await prisma.productGroup.findMany({ orderBy: { name: "asc" } });
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/catalog/products" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          ← Товары
        </Link>
        <h1 className="mt-2 font-serif text-4xl">{isNew ? "Новый товар" : product!.name}</h1>
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
            <Input id="purchasePrice" name="purchasePrice" type="number" defaultValue={product?.purchasePrice ?? 0} />
          </div>
          <div>
            <Label htmlFor="retailPrice">Розничная</Label>
            <Input id="retailPrice" name="retailPrice" type="number" defaultValue={product?.retailPrice ?? 0} />
          </div>
          <div>
            <Label htmlFor="repairPrice">Ремонтная</Label>
            <Input id="repairPrice" name="repairPrice" type="number" defaultValue={product?.repairPrice ?? 0} />
          </div>
          <div>
            <Label htmlFor="preorderPrice">Под заказ</Label>
            <Input id="preorderPrice" name="preorderPrice" type="number" defaultValue={product?.preorderPrice ?? 0} />
          </div>
          <div>
            <Label htmlFor="warrantyDays">Гарантия, дней</Label>
            <Input id="warrantyDays" name="warrantyDays" type="number" defaultValue={product?.warrantyDays ?? 365} />
          </div>
          <div>
            <Label htmlFor="minStock">Мин. остаток</Label>
            <Input id="minStock" name="minStock" type="number" defaultValue={product?.minStock ?? 0} />
          </div>
          <div>
            <Label htmlFor="commissionPct">Комиссия %</Label>
            <Input id="commissionPct" name="commissionPct" type="number" defaultValue={product?.commissionPct ?? 0} />
          </div>
          <div>
            <Label htmlFor="commissionRub">Комиссия ₽</Label>
            <Input id="commissionRub" name="commissionRub" type="number" defaultValue={product?.commissionRub ?? 0} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="serialTracked" defaultChecked={product?.serialTracked ?? false} />
          Серийный товар (IMEI / S/N)
        </label>
        <div>
          <Label htmlFor="description">Описание</Label>
          <Textarea id="description" name="description" defaultValue={product?.description ?? ""} />
        </div>
        <Button type="submit">Сохранить</Button>
      </form>

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
    </div>
  );
}
