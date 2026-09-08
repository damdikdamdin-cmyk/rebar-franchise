"use client";

import { useState } from "react";
import { Input, Label, Textarea } from "@/components/ui/fields";

type StoreOpt = { id: string; city: string };

export function SerialTrackedFields({
  defaultChecked = false,
  stores,
  existingSerials = [],
}: {
  defaultChecked?: boolean;
  stores: StoreOpt[];
  existingSerials?: Array<{ serial: string; status: string; storeCity: string }>;
}) {
  const [on, setOn] = useState(defaultChecked);

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="serialTracked"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
        />
        Серийный товар (IMEI / S/N)
      </label>

      {on ? (
        <div className="space-y-3 border border-border bg-background p-4">
          <div>
            <Label htmlFor="serialStoreId">Точка для новых S/N</Label>
            <select
              id="serialStoreId"
              name="serialStoreId"
              defaultValue={stores[0]?.id ?? ""}
              className="flex h-9 w-full border border-input bg-background px-3 text-sm"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.city}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="newSerials">Добавить IMEI / S/N (по одному на строку)</Label>
            <Textarea id="newSerials" name="newSerials" rows={4} className="font-mono" />
          </div>
          {existingSerials.length ? (
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Уже на учёте
              </p>
              <ul className="max-h-40 space-y-1 overflow-auto text-sm">
                {existingSerials.map((s) => (
                  <li
                    key={`${s.serial}-${s.storeCity}`}
                    className="flex justify-between gap-2 border-b border-border py-1 font-mono text-xs"
                  >
                    <span>{s.serial}</span>
                    <span className="text-muted-foreground">
                      {s.storeCity} · {s.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
