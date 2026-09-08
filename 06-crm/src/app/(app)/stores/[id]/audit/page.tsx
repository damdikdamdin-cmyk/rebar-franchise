import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { assertStoreAccess, isAdmin, isUk } from "@/lib/access";
import { dateTime } from "@/lib/format";
import { dayRange } from "@/lib/excel-csv";
import { Input, Label } from "@/components/ui/fields";

export default async function StoreAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; userId?: string; q?: string }>;
}) {
  const { id: storeId } = await params;
  const user = await requireUser();
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store || !assertStoreAccess(user, store)) redirect("/");

  const canView =
    isAdmin(user.role) ||
    user.role === "uk_curator" ||
    user.role === "partner" ||
    user.role === "store_manager" ||
    isUk(user.role);
  if (!canView) redirect(`/stores/${storeId}`);

  const sp = await searchParams;
  const { from, to, fromYmd, toYmd } = dayRange(sp.from, sp.to);
  const userId = sp.userId || "";
  const q = (sp.q ?? "").trim();

  const [logs, staff] = await Promise.all([
    prisma.changeLog.findMany({
      where: {
        storeId,
        createdAt: { gte: from, lte: to },
        ...(userId ? { userId } : {}),
        ...(q
          ? {
              OR: [
                { summary: { contains: q } },
                { serialOld: { contains: q } },
                { serialNew: { contains: q } },
                { action: { contains: q } },
              ],
            }
          : {}),
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.user.findMany({
      where: {
        OR: [{ storeId }, { changeLogs: { some: { storeId } } }],
      },
      orderBy: { name: "asc" },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">История</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Кто · что изменил · когда — для куратора и администратора точки
          </p>
        </div>
        <Link href={`/stores/${storeId}/schedule`} className="border border-border px-3 py-1.5 font-mono text-[10px] uppercase">
          График
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-2 border border-border bg-card p-3">
        <div>
          <Label>С</Label>
          <Input type="date" name="from" defaultValue={fromYmd} />
        </div>
        <div>
          <Label>По</Label>
          <Input type="date" name="to" defaultValue={toYmd} />
        </div>
        <div>
          <Label>Сотрудник</Label>
          <select name="userId" defaultValue={userId} className="mt-1 flex h-9 border border-input bg-background px-2 text-sm">
            <option value="">Все</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
          <Label>Поиск</Label>
          <Input name="q" defaultValue={q} placeholder="IMEI, чек, действие…" />
        </div>
        <button type="submit" className="h-9 border border-border bg-foreground px-4 text-sm text-background">
          Показать
        </button>
      </form>

      <ul className="divide-y divide-border border border-border bg-card">
        {!logs.length ? (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">Записей за период нет</li>
        ) : null}
        {logs.map((log) => (
          <li key={log.id} className="px-4 py-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">{log.summary}</p>
              <time className="shrink-0 font-mono text-[10px] text-muted-foreground">{dateTime(log.createdAt)}</time>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {log.user?.name ?? "система"}
              {log.action ? ` · ${log.action}` : ""}
              {log.field ? ` · поле ${log.field}` : ""}
              {log.oldValue || log.newValue
                ? ` · ${log.oldValue ?? "—"} → ${log.newValue ?? "—"}`
                : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
