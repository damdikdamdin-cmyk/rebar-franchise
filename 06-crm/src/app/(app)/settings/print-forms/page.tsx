import Link from "next/link";
import { requireUser } from "@/lib/session";
import { canAccessTeam, isUk } from "@/lib/access";
import { listTemplates } from "@/lib/print/templates";
import { SCOPE_LABEL, type PrintScope } from "@/lib/print/variables";
import { createPrintTemplate } from "@/actions/print";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";
import { shortDate } from "@/lib/format";

export default async function PrintFormsPage() {
  const user = await requireUser();
  const canEdit =
    isUk(user.role) || user.role === "partner" || user.role === "store_manager" || canAccessTeam(user.role);
  const templates = await listTemplates();

  const byScope = templates.reduce<Record<string, typeof templates>>((acc, t) => {
    (acc[t.scope] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Настройки</p>
          <h1 className="mt-1 font-serif text-3xl">Печатные формы</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Гарантийные талоны, чеки, ценники, этикетки и бланки. УК, партнёры и управляющие правят шаблон —
            при печати подставляются цена, гарантия, IMEI и данные из остатков.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/settings/devices">Устройства</Link>
        </Button>
      </div>

      {canEdit ? (
        <form action={createPrintTemplate} className="flex flex-wrap items-end gap-3 border border-border bg-card p-4">
          <div>
            <Label>Новая форма</Label>
            <Input name="name" placeholder="Название" required />
          </div>
          <div>
            <Label>Тип</Label>
            <select name="scope" className="h-9 border border-border bg-background px-2 text-sm" defaultValue="free">
              {(Object.keys(SCOPE_LABEL) as PrintScope[]).map((k) => (
                <option key={k} value={k}>
                  {SCOPE_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">Создать</Button>
        </form>
      ) : null}

      {Object.entries(byScope).map(([scope, list]) => (
        <section key={scope}>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {SCOPE_LABEL[scope as PrintScope] ?? scope}
          </h2>
          <div className="mt-3 overflow-x-auto border border-border bg-card">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3">Форма</th>
                  <th className="px-4 py-3">Размер</th>
                  <th className="px-4 py-3">Обновлена</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/settings/print-forms/${t.id}`} className="hover:underline">
                        {t.name}
                      </Link>
                      {t.isSystem ? (
                        <span className="ml-2 font-mono text-[10px] uppercase text-muted-foreground">системная</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {t.pageWidthMm}×{t.pageHeightMm} мм
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{shortDate(t.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/print/${t.key}?sample=1`} target="_blank" className="font-mono text-[10px] uppercase underline">
                        печать
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
