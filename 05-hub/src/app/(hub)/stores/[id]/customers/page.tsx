import { prisma } from "@/lib/prisma";
import { createCustomer } from "@/actions/ops";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/fields";

export default async function StoreCustomersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customers = await prisma.customer.findMany({
    where: { storeId: id },
    include: { _count: { select: { sales: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <form action={createCustomer} className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-2">
        <input type="hidden" name="storeId" value={id} />
        <div>
          <Label htmlFor="name">Имя</Label>
          <Input id="name" name="name" required />
        </div>
        <div>
          <Label htmlFor="phone">Телефон</Label>
          <Input id="phone" name="phone" required />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="notes">Заметка</Label>
          <Textarea id="notes" name="notes" />
        </div>
        <Button type="submit">Сохранить клиента</Button>
      </form>
      <ul className="divide-y divide-border border border-border bg-card">
        {customers.map((c) => (
          <li key={c.id} className="flex justify-between px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{c.phone}</p>
            </div>
            <p className="font-mono text-xs text-muted-foreground">{c._count.sales} продаж</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
