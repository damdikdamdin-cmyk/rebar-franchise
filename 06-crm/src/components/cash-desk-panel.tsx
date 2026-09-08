"use client";

import { useMemo, useState } from "react";
import {
  createCashRegister,
  createManualCashTxn,
  deleteCashCategory,
  renameCashRegister,
  transferCashBetweenRegisters,
  upsertCashCategory,
} from "@/actions/retail";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";
import { rub } from "@/lib/format-client";

type Register = { id: string; name: string; balance: number };
type Category = { id: string; name: string; direction: "in" | "out"; system: boolean };

export function CashDeskPanel({
  storeId,
  registers,
  categories,
}: {
  storeId: string;
  registers: Register[];
  categories: Category[];
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [transferFrom, setTransferFrom] = useState<string | null>(null);
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [catEditId, setCatEditId] = useState<string | null>(null);

  const filteredCats = useMemo(
    () => categories.filter((c) => c.direction === direction),
    [categories, direction],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Кассы</h2>
        <form action={createCashRegister} className="flex flex-wrap gap-2">
          <input type="hidden" name="storeId" value={storeId} />
          <Input name="name" placeholder="Название новой кассы" className="w-48" required />
          <Button type="submit" variant="outline" size="sm">
            + Касса
          </Button>
        </form>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {registers.map((r) => (
          <li key={r.id} className="border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="mt-2 font-mono text-2xl">{rub(r.balance)}</p>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  className="font-mono text-[10px] uppercase underline"
                  onClick={() => setEditId(editId === r.id ? null : r.id)}
                >
                  Изменить
                </button>
                <button
                  type="button"
                  className="font-mono text-[10px] uppercase underline"
                  onClick={() => setTransferFrom(transferFrom === r.id ? null : r.id)}
                >
                  Переместить
                </button>
              </div>
            </div>

            {editId === r.id ? (
              <form action={renameCashRegister} className="mt-3 flex gap-2 border-t border-border pt-3">
                <input type="hidden" name="storeId" value={storeId} />
                <input type="hidden" name="registerId" value={r.id} />
                <Input name="name" defaultValue={r.name} required />
                <Button type="submit" size="sm">
                  Сохранить
                </Button>
              </form>
            ) : null}

            {transferFrom === r.id ? (
              <form action={transferCashBetweenRegisters} className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-2">
                <input type="hidden" name="storeId" value={storeId} />
                <input type="hidden" name="fromRegisterId" value={r.id} />
                <div className="sm:col-span-2">
                  <Label required>Куда</Label>
                  <select
                    name="toRegisterId"
                    required
                    className="mt-1 flex h-9 w-full border border-input bg-background px-3 text-sm"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Выберите кассу
                    </option>
                    {registers
                      .filter((x) => x.id !== r.id)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name} · {rub(x.balance)}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <Label required>Сумма</Label>
                  <Input name="amount" inputMode="numeric" required />
                </div>
                <div>
                  <Label>Примечание</Label>
                  <Input name="note" />
                </div>
                <Button type="submit" className="sm:col-span-2" size="sm">
                  Переместить деньги
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>

      <form action={createManualCashTxn} className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-2">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground sm:col-span-2">
          Операция
        </h3>
        <input type="hidden" name="storeId" value={storeId} />
        <div>
          <Label required>Касса</Label>
          <select name="registerId" className="mt-1 flex h-9 w-full border border-input bg-background px-3 text-sm" required>
            {registers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label required>Направление</Label>
          <select
            name="direction"
            className="mt-1 flex h-9 w-full border border-input bg-background px-3 text-sm"
            value={direction}
            onChange={(e) => setDirection(e.target.value as "in" | "out")}
          >
            <option value="in">Приход</option>
            <option value="out">Расход</option>
          </select>
        </div>
        <div>
          <Label required>Статья</Label>
          <select name="categoryName" className="mt-1 flex h-9 w-full border border-input bg-background px-3 text-sm" required>
            {filteredCats.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label required>Сумма</Label>
          <Input name="amount" inputMode="numeric" required />
        </div>
        <div>
          <Label>Получатель</Label>
          <Input name="recipient" />
        </div>
        <div>
          <Label>Примечание</Label>
          <Input name="note" />
        </div>
        <Button type="submit" className="sm:col-span-2">
          Провести
        </Button>
      </form>

      <section className="border border-border bg-card p-4">
        <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Статьи и направления
        </h3>
        <form action={upsertCashCategory} className="mb-4 grid gap-2 sm:grid-cols-4">
          <input type="hidden" name="storeId" value={storeId} />
          <input type="hidden" name="id" value={catEditId ?? ""} />
          <div className="sm:col-span-2">
            <Label required>Название статьи</Label>
            <Input
              name="name"
              required
              key={catEditId ?? "new"}
              defaultValue={catEditId ? categories.find((c) => c.id === catEditId)?.name ?? "" : ""}
            />
          </div>
          <div>
            <Label required>Направление</Label>
            <select
              name="direction"
              className="mt-1 flex h-9 w-full border border-input bg-background px-3 text-sm"
              defaultValue={catEditId ? categories.find((c) => c.id === catEditId)?.direction ?? "out" : "out"}
            >
              <option value="in">Приход</option>
              <option value="out">Расход</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" size="sm">
              {catEditId ? "Сохранить" : "Добавить"}
            </Button>
            {catEditId ? (
              <button type="button" className="font-mono text-[10px] uppercase" onClick={() => setCatEditId(null)}>
                отмена
              </button>
            ) : null}
          </div>
        </form>

        <ul className="divide-y divide-border border border-border">
          {categories.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>
                {c.name}{" "}
                <span className="font-mono text-[10px] text-muted-foreground">
                  {c.direction === "in" ? "приход" : "расход"}
                  {c.system ? " · системная" : ""}
                </span>
              </span>
              {!c.system ? (
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="font-mono text-[10px] uppercase underline"
                    onClick={() => setCatEditId(c.id)}
                  >
                    изменить
                  </button>
                  <form action={deleteCashCategory}>
                    <input type="hidden" name="storeId" value={storeId} />
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="font-mono text-[10px] uppercase text-red-600">
                      удалить
                    </button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
