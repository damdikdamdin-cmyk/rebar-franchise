"use client";

import { PERMISSION_SECTIONS, type PermissionKey, type PermissionMap } from "@/lib/permissions";

export function RolePermissionsForm({
  defaults,
  idPrefix = "",
}: {
  defaults?: PermissionMap;
  idPrefix?: string;
}) {
  return (
    <div className="space-y-4">
      {PERMISSION_SECTIONS.map((section) => (
        <details key={section.id} open className="border border-border bg-card">
          <summary className="cursor-pointer px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em]">
            {section.label}
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {section.keys.map(({ key, label }) => (
              <li key={key} className="flex items-center gap-3 px-4 py-2 text-sm">
                <input
                  type="checkbox"
                  name={`perm_${key}`}
                  id={`${idPrefix}${key}`}
                  defaultChecked={Boolean(defaults?.[key as PermissionKey])}
                  className="size-4 accent-foreground"
                />
                <label htmlFor={`${idPrefix}${key}`} className="cursor-pointer">
                  {label}
                </label>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
