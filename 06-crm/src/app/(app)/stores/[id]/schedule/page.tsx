import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { dateTime, rub } from "@/lib/format";
import { upsertWorkShift, deleteWorkShift } from "@/actions/retail";
import { createInvite } from "@/actions/team";
import { ensureSystemAccessRoles } from "@/lib/access-roles";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";
import { ROLE_LABEL } from "@/lib/access";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonth(raw?: string) {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split("-").map(Number);
    return new Date(y, m - 1, 1, 12, 0, 0, 0);
  }
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1, 12, 0, 0, 0);
}

/** Сетка месяца: пн–вс, включая дни соседних месяцев для выравнивания. */
function monthGrid(monthStart: Date) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const first = new Date(year, month, 1, 12, 0, 0, 0);
  const last = new Date(year, month + 1, 0, 12, 0, 0, 0);
  const startPad = (first.getDay() + 6) % 7; // Mon=0
  const cells: Date[] = [];
  const gridStart = new Date(year, month, 1 - startPad, 12, 0, 0, 0);
  const cur = new Date(gridStart);
  while (cur <= last || cells.length % 7 !== 0) {
    cells.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
    if (cells.length >= 42) break;
  }
  return { cells, first, last };
}

export default async function SchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; week?: string; edit?: string; invited?: string; date?: string; user?: string }>;
}) {
  const { id: storeId } = await params;
  const sp = await searchParams;

  await ensureSystemAccessRoles();

  // совместимость со старым ?week=
  const monthStart = sp.month
    ? parseMonth(sp.month)
    : sp.week
      ? (() => {
          const w = new Date(`${sp.week}T12:00:00`);
          return new Date(w.getFullYear(), w.getMonth(), 1, 12, 0, 0, 0);
        })()
      : parseMonth();

  const { cells, first, last } = monthGrid(monthStart);
  const monthParam = monthKey(monthStart);
  const prevMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1, 12);
  const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1, 12);
  const todayKey = ymd(new Date());
  const monthLabel = monthStart.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  const rangeStart = new Date(first);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(last);
  rangeEnd.setHours(23, 59, 59, 999);

  const [staff, shifts, accessRoles, pendingInvites, shiftLogs] = await Promise.all([
    prisma.user.findMany({
      where: { storeId, role: { in: ["seller", "store_manager"] } },
      include: { accessRole: true },
      orderBy: { name: "asc" },
    }),
    prisma.workShift.findMany({
      where: {
        storeId,
        deletedAt: null,
        date: { gte: rangeStart, lte: rangeEnd },
      },
      include: { user: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.accessRole.findMany({
      where: { OR: [{ system: true, storeId: null }, { storeId }] },
      orderBy: [{ system: "desc" }, { name: "asc" }],
    }),
    prisma.invite.findMany({
      where: { storeId, usedAt: null, expiresAt: { gt: new Date() } },
      include: { accessRole: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.changeLog.findMany({
      where: {
        storeId,
        entityType: "work_shift",
        createdAt: { gte: rangeStart, lte: rangeEnd },
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  const edit = sp.edit ? shifts.find((s) => s.id === sp.edit) : null;
  const appUrl = process.env.APP_URL ?? "http://localhost:3100";
  const stickyUserId = edit?.userId ?? sp.user ?? staff[0]?.id ?? "";
  const stickyDate = edit ? ymd(edit.date) : sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayKey;

  const byDay = new Map<string, typeof shifts>();
  for (const s of shifts) {
    const key = ymd(s.date);
    const list = byDay.get(key) ?? [];
    list.push(s);
    byDay.set(key, list);
  }

  const monthShifts = shifts.filter((s) => {
    const d = s.date;
    return d.getFullYear() === monthStart.getFullYear() && d.getMonth() === monthStart.getMonth();
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">График</h2>
          <p className="mt-1 text-sm text-muted-foreground capitalize">
            {monthLabel} · прошлые дни сохраняются, правки пишутся в историю
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/stores/${storeId}/payroll`}
            className="border border-border px-3 py-1.5 font-mono text-[10px] uppercase"
          >
            Зарплата
          </Link>
          <Link
            href={`/stores/${storeId}/audit?q=смен`}
            className="border border-border px-3 py-1.5 font-mono text-[10px] uppercase"
          >
            История
          </Link>
          <Link
            href={`/stores/${storeId}/schedule?month=${monthKey(prevMonth)}`}
            className="border border-border px-3 py-1.5 font-mono text-[10px] uppercase"
          >
            ← Месяц
          </Link>
          <Link
            href={`/stores/${storeId}/schedule?month=${monthKey(new Date())}`}
            className="border border-border px-3 py-1.5 font-mono text-[10px] uppercase"
          >
            Сегодня
          </Link>
          <Link
            href={`/stores/${storeId}/schedule?month=${monthKey(nextMonth)}`}
            className="border border-border px-3 py-1.5 font-mono text-[10px] uppercase"
          >
            Месяц →
          </Link>
        </div>
      </div>

      <section className="border border-border bg-card p-4">
        <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Добавить сотрудника
        </h3>
        {sp.invited ? (
          <p className="mb-3 text-sm text-muted-foreground">Приглашение создано — отправьте ссылку сотруднику.</p>
        ) : null}
        <form action={createInvite} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <input type="hidden" name="storeId" value={storeId} />
          <input type="hidden" name="returnTo" value={`/stores/${storeId}/schedule?month=${monthParam}`} />
          <div>
            <Label required>Имя</Label>
            <Input name="name" required placeholder="Как в чеках" />
          </div>
          <div>
            <Label required>Email</Label>
            <Input name="email" type="email" required />
          </div>
          <div>
            <Label required>Роль</Label>
            <select
              name="role"
              defaultValue="seller"
              className="mt-1 flex h-9 w-full border border-input bg-background px-3 text-sm"
            >
              <option value="seller">{ROLE_LABEL.seller}</option>
              <option value="store_manager">{ROLE_LABEL.store_manager}</option>
            </select>
          </div>
          <div>
            <Label>Шаблон прав</Label>
            <select
              name="accessRoleId"
              defaultValue={accessRoles.find((a) => a.name === "Продавец")?.id ?? ""}
              className="mt-1 flex h-9 w-full border border-input bg-background px-3 text-sm"
            >
              <option value="">— по роли —</option>
              {accessRoles.map((ar) => (
                <option key={ar.id} value={ar.id}>
                  {ar.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end sm:col-span-2 lg:col-span-1">
            <Button type="submit" className="w-full">
              Создать приглашение
            </Button>
          </div>
        </form>
        {pendingInvites.length ? (
          <ul className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
            {pendingInvites.map((i) => (
              <li key={i.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {i.nameHint ?? i.email} · {ROLE_LABEL[i.role]}
                  {i.accessRole ? ` · ${i.accessRole.name}` : ""}
                </span>
                <code className="text-xs text-muted-foreground">
                  {appUrl}/join/{i.token}
                </code>
              </li>
            ))}
          </ul>
        ) : null}
        {staff.length ? (
          <p className="mt-3 text-xs text-muted-foreground">
            В точке: {staff.map((u) => `${u.name}${u.accessRole ? ` (${u.accessRole.name})` : ""}`).join(", ")}
          </p>
        ) : null}
      </section>

      <section className="border border-border bg-card p-4">
        <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {edit ? "Редактировать смену" : "Поставить в график"}
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Сотрудник запоминается после постановки. Кликнув по дню в календаре — подставится дата.
        </p>
        <form action={upsertWorkShift} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <input type="hidden" name="storeId" value={storeId} />
          <input type="hidden" name="month" value={monthParam} />
          {edit ? <input type="hidden" name="id" value={edit.id} /> : null}
          <div>
            <Label required>Сотрудник</Label>
            <select
              name="userId"
              required
              key={`user-${stickyUserId}-${edit?.id ?? "new"}`}
              defaultValue={stickyUserId}
              className="mt-1 flex h-9 w-full border border-input bg-background px-3 text-sm"
            >
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · смена {rub(u.shiftPay || 2000)} · {u.commissionPct || 0.5}%
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label required>Дата</Label>
            <Input name="date" type="date" required defaultValue={stickyDate} key={`date-${stickyDate}-${edit?.id ?? "new"}`} />
          </div>
          <div>
            <Label>Начало</Label>
            <Input name="startTime" defaultValue={edit?.startTime ?? "10:00"} />
          </div>
          <div>
            <Label>Конец</Label>
            <Input name="endTime" defaultValue={edit?.endTime ?? "20:00"} />
          </div>
          <div>
            <Label>Оклад смены, ₽</Label>
            <Input
              name="shiftPay"
              type="number"
              placeholder="из ставки сотрудника"
              defaultValue={edit?.shiftPay ?? ""}
            />
          </div>
          <div>
            <Label>Заметка</Label>
            <Input name="note" defaultValue={edit?.note ?? ""} />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
            <Button type="submit">{edit ? "Сохранить" : "Поставить в график"}</Button>
            {edit ? (
              <Link
                href={`/stores/${storeId}/schedule?month=${monthParam}`}
                className="border border-border px-3 py-2 text-sm"
              >
                Отмена
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      <div>
        <div className="mb-2 grid grid-cols-7 gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((d) => (
            <div key={d} className="px-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d) => {
            const key = ymd(d);
            const inMonth = d.getMonth() === monthStart.getMonth();
            const isPast = key < todayKey;
            const isToday = key === todayKey;
            const list = byDay.get(key) ?? [];
            return (
              <div
                key={key}
                className={`min-h-[110px] border p-1.5 ${
                  inMonth ? "border-border bg-card" : "border-transparent bg-muted/30 opacity-50"
                } ${isToday ? "ring-1 ring-foreground" : ""} ${isPast && inMonth ? "bg-muted/40" : ""}`}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <Link
                    href={`/stores/${storeId}/schedule?month=${monthParam}&date=${key}${stickyUserId ? `&user=${stickyUserId}` : ""}`}
                    className={`font-mono text-[11px] underline-offset-2 hover:underline ${
                      isToday ? "font-semibold text-foreground" : "text-muted-foreground"
                    } ${sp.date === key ? "underline" : ""}`}
                  >
                    {d.getDate()}
                  </Link>
                  {isPast && inMonth && list.length ? (
                    <span className="font-mono text-[9px] uppercase text-muted-foreground">было</span>
                  ) : null}
                </div>
                {inMonth && !edit ? (
                  <Link
                    href={`/stores/${storeId}/schedule?month=${monthParam}&date=${key}${stickyUserId ? `&user=${stickyUserId}` : ""}`}
                    className="mt-1 block font-mono text-[9px] uppercase text-muted-foreground hover:text-foreground"
                  >
                    + смена
                  </Link>
                ) : null}
                <ul className="mt-1 space-y-1">
                  {list.map((s) => (
                    <li key={s.id} className="border border-border bg-background p-1 text-[10px] leading-tight">
                      <p className="truncate font-medium">{s.user.name}</p>
                      <p className="text-muted-foreground">
                        {s.startTime}–{s.endTime}
                      </p>
                      <p className="font-mono">{rub(s.shiftPay ?? s.user.shiftPay ?? 0)}</p>
                      {inMonth ? (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          <Link
                            href={`/stores/${storeId}/schedule?month=${monthParam}&edit=${s.id}`}
                            className="underline"
                          >
                            изм.
                          </Link>
                          <form action={deleteWorkShift} className="inline">
                            <input type="hidden" name="storeId" value={storeId} />
                            <input type="hidden" name="id" value={s.id} />
                            <input type="hidden" name="month" value={monthParam} />
                            <button type="submit" className="text-destructive underline">
                              убрать
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <section>
        <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Смены месяца · {monthShifts.length}
        </h3>
        <ul className="divide-y divide-border border border-border bg-card">
          {!monthShifts.length ? (
            <li className="px-4 py-4 text-sm text-muted-foreground">Смен в этом месяце нет</li>
          ) : null}
          {monthShifts.map((s) => {
            const key = ymd(s.date);
            const past = key < todayKey;
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p>
                    {s.user.name} · {key} · {s.startTime}–{s.endTime}
                    {past ? <span className="ml-2 text-xs text-muted-foreground">прошедшая</span> : null}
                  </p>
                  {s.note ? <p className="text-xs text-muted-foreground">{s.note}</p> : null}
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-mono text-xs">{rub(s.shiftPay ?? s.user.shiftPay ?? 0)}</p>
                  <Link
                    href={`/stores/${storeId}/schedule?month=${monthParam}&edit=${s.id}`}
                    className="font-mono text-[10px] uppercase underline"
                  >
                    изменить
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            История изменений графика
          </h3>
          <Link href={`/stores/${storeId}/audit`} className="font-mono text-[10px] uppercase underline">
            Вся история точки
          </Link>
        </div>
        <ul className="divide-y divide-border border border-border bg-card">
          {!shiftLogs.length ? (
            <li className="px-4 py-4 text-sm text-muted-foreground">
              Пока нет записей за этот месяц — постановка и правка смен появятся здесь
            </li>
          ) : null}
          {shiftLogs.map((log) => (
            <li key={log.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p>{log.summary}</p>
                <time className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {dateTime(log.createdAt)}
                </time>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {log.user?.name ?? "система"} · {log.action}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
