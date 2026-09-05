"use client";

import { useState } from "react";
import { Markdown } from "@/components/kb/markdown";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/fields";
import { ALL_ROLES, ROLE_LABEL } from "@/lib/access";

type Space = { id: string; name: string };

export function ArticleEditor({
  action,
  spaces,
  initial,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  spaces: Space[];
  initial?: {
    id?: string;
    title?: string;
    summary?: string | null;
    body?: string;
    tags?: string | null;
    spaceId?: string;
    status?: string;
    visibleRoles?: string | null;
  };
  submitLabel: string;
}) {
  const [body, setBody] = useState(initial?.body ?? "");
  const [preview, setPreview] = useState(false);
  const selectedRoles = new Set((initial?.visibleRoles ?? "").split(",").map((r) => r.trim()).filter(Boolean));

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div className="space-y-4">
        <Field label="Заголовок">
          <Input name="title" defaultValue={initial?.title ?? ""} required className="h-11 text-lg" />
        </Field>
        <Field label="Кратко">
          <Input name="summary" defaultValue={initial?.summary ?? ""} placeholder="Одно предложение о чём статья" />
        </Field>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="eyebrow">Текст · Markdown</span>
            <div className="flex gap-1">
              <Button type="button" size="xs" variant={preview ? "ghost" : "secondary"} onClick={() => setPreview(false)}>
                Редактор
              </Button>
              <Button type="button" size="xs" variant={preview ? "secondary" : "ghost"} onClick={() => setPreview(true)}>
                Превью
              </Button>
            </div>
          </div>
          {preview ? (
            <div className="min-h-[60vh] rounded-md border border-border bg-card px-6 py-4">
              <Markdown body={body} />
            </div>
          ) : (
            <Textarea
              name="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[60vh] font-mono text-[13px] leading-relaxed"
              spellCheck={false}
            />
          )}
          {preview ? <input type="hidden" name="body" value={body} /> : null}
        </div>
      </div>

      <aside className="space-y-4">
        <Field label="Раздел">
          <Select name="spaceId" defaultValue={initial?.spaceId ?? spaces[0]?.id}>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Статус">
          <Select name="status" defaultValue={initial?.status ?? "published"}>
            <option value="published">Опубликована</option>
            <option value="draft">Черновик</option>
            <option value="archived">Архив</option>
          </Select>
        </Field>
        <Field label="Теги" hint="Через запятую">
          <Input name="tags" defaultValue={initial?.tags ?? ""} />
        </Field>
        <div>
          <p className="eyebrow mb-1">Кому видно</p>
          <p className="mb-2 text-xs text-muted-foreground">Пусто — как у раздела. Основатель и админ видят всё.</p>
          <div className="grid grid-cols-1 gap-1">
            {ALL_ROLES.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="roles" value={r} defaultChecked={selectedRoles.has(r)} className="accent-foreground" />
                {ROLE_LABEL[r]}
              </label>
            ))}
          </div>
        </div>
        <Button type="submit" className="w-full">
          {submitLabel}
        </Button>
      </aside>
    </form>
  );
}
