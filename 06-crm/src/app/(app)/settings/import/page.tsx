import { prisma } from "@/lib/prisma";
import { importCustomersCsv, importProductsCsv, importStockCsv } from "@/actions/retail";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/fields";
import { requireUser } from "@/lib/session";
import { isUk } from "@/lib/access";
import { redirect } from "next/navigation";

export default async function ImportPage() {
  const user = await requireUser();
  if (!isUk(user.role)) redirect("/");

  const stores = await prisma.store.findMany({ orderBy: [{ city: "asc" }, { name: "asc" }] });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Cutover</p>
        <h1 className="mt-1 font-serif text-4xl">Импорт из LiveSklad</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          CSV с разделителем «;». Экспорт вручную из LiveSklad → вставка сюда. Чеклист cutover:{" "}
          <code className="font-mono text-xs">03-crm-and-ops/crm/cutover-ulan-irkutsk.md</code>
        </p>
      </div>

      <section className="space-y-3 border border-border bg-card p-4">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Товары</h2>
        <p className="text-xs text-muted-foreground">Заголовок: code;name;retail;purchase;serial (1/0)</p>
        <form action={importProductsCsv} className="space-y-3">
          <div>
            <Label htmlFor="products-csv">CSV</Label>
            <Textarea id="products-csv" name="csv" rows={8} placeholder={"code;name;retail;purchase;serial\nIP15P;iPhone 15 Pro;120000;98000;1"} />
          </div>
          <Button type="submit">Импортировать товары</Button>
        </form>
      </section>

      <section className="space-y-3 border border-border bg-card p-4">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Остатки</h2>
        <p className="text-xs text-muted-foreground">Заголовок: code;qty — только для cutover (прямая установка остатка)</p>
        <form action={importStockCsv} className="space-y-3">
          <div>
            <Label htmlFor="stock-store">Точка</Label>
            <select id="stock-store" name="storeId" className="mt-1 flex h-9 w-full border border-input bg-background px-3 text-sm" required>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.city} · {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="stock-csv">CSV</Label>
            <Textarea id="stock-csv" name="csv" rows={6} placeholder={"code;qty\nIP15P;3"} />
          </div>
          <Button type="submit">Импортировать остатки</Button>
        </form>
      </section>

      <section className="space-y-3 border border-border bg-card p-4">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Клиенты</h2>
        <p className="text-xs text-muted-foreground">Заголовок: name;phone;notes</p>
        <form action={importCustomersCsv} className="space-y-3">
          <div>
            <Label htmlFor="cust-store">Точка</Label>
            <select id="cust-store" name="storeId" className="mt-1 flex h-9 w-full border border-input bg-background px-3 text-sm" required>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.city} · {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="cust-csv">CSV</Label>
            <Textarea id="cust-csv" name="csv" rows={6} placeholder={"name;phone;notes\nИван;+7913...;VIP"} />
          </div>
          <Button type="submit">Импортировать клиентов</Button>
        </form>
      </section>
    </div>
  );
}
