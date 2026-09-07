"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import { savePrintTemplate, resetPrintTemplate, deactivatePrintTemplate } from "@/actions/print";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";
import { PAGE_PRESETS, SCOPE_LABEL, variablesFor, type PrintScope } from "@/lib/print/variables";
import { cn } from "@/lib/utils";

type Template = {
  id: string;
  key: string;
  name: string;
  scope: string;
  html: string;
  pageWidthMm: number;
  pageHeightMm: number;
  marginMm: number;
  fontSizePt: number;
  isSystem: boolean;
};

export function PrintFormEditor({ template, canEdit }: { template: Template; canEdit: boolean }) {
  const [name, setName] = useState(template.name);
  const [pageWidthMm, setW] = useState(template.pageWidthMm);
  const [pageHeightMm, setH] = useState(template.pageHeightMm);
  const [marginMm, setM] = useState(template.marginMm);
  const [fontSizePt, setFs] = useState(template.fontSizePt);
  const [sourceMode, setSourceMode] = useState(false);
  const [source, setSource] = useState(template.html);
  const [openGroup, setOpenGroup] = useState<string | null>("document");
  const [query, setQuery] = useState("");
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => {
    const all = variablesFor(template.scope as PrintScope);
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all
      .map((g) => ({ ...g, vars: g.vars.filter((v) => v.name.toLowerCase().includes(q) || v.label.toLowerCase().includes(q)) }))
      .filter((g) => g.vars.length);
  }, [template.scope, query]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TableKit.configure({ table: { resizable: true } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyleKit,
      Underline,
      Image,
    ],
    content: template.html,
    editable: canEdit && !sourceMode,
    editorProps: {
      attributes: {
        class: "prose-print min-h-[420px] outline-none",
      },
    },
  });

  useEffect(() => {
    if (!editor || sourceMode) return;
    setSource(editor.getHTML());
  }, [editor, sourceMode, editor?.state]);

  const insertVar = useCallback(
    (name: string) => {
      const token = `<${name}>`;
      if (sourceMode) {
        setSource((s) => s + token);
        return;
      }
      editor?.chain().focus().insertContent(token).run();
    },
    [editor, sourceMode],
  );

  function applyPreset(id: string) {
    const p = PAGE_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setW(p.w);
    setH(p.h);
    setM(p.margin);
    setFs(p.font);
  }

  function onSave() {
    const html = sourceMode ? source : (editor?.getHTML() ?? source);
    const fd = new FormData();
    fd.set("id", template.id);
    fd.set("name", name);
    fd.set("html", html);
    fd.set("pageWidthMm", String(pageWidthMm));
    fd.set("pageHeightMm", String(pageHeightMm));
    fd.set("marginMm", String(marginMm));
    fd.set("fontSizePt", String(fontSizePt));
    start(async () => {
      await savePrintTemplate(fd);
      setSavedAt(new Date().toLocaleTimeString("ru-RU"));
    });
  }

  function onImage(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result ?? "");
      if (sourceMode) setSource((s) => s + `<img src="${src}" alt="" />`);
      else editor?.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
  }

  const previewHref = `/print/${template.key}?sample=1`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 border-b border-border pb-4">
        <div className="min-w-[200px] flex-1">
          <Label>Название формы</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Тип</p>
          <p className="mt-1 text-sm">{SCOPE_LABEL[template.scope as PrintScope] ?? template.scope}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Button type="button" onClick={onSave} disabled={pending}>
              {pending ? "Сохраняем…" : "Сохранить"}
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href={previewHref} target="_blank">
              Предпросмотр
            </Link>
          </Button>
          {template.isSystem && canEdit ? (
            <form action={resetPrintTemplate}>
              <input type="hidden" name="id" value={template.id} />
              <Button type="submit" variant="outline">
                По умолчанию
              </Button>
            </form>
          ) : null}
          {!template.isSystem && canEdit ? (
            <form action={deactivatePrintTemplate}>
              <input type="hidden" name="id" value={template.id} />
              <Button type="submit" variant="outline">
                Удалить
              </Button>
            </form>
          ) : null}
        </div>
        {savedAt ? <p className="w-full font-mono text-[10px] text-muted-foreground">Сохранено {savedAt}</p> : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <Label>Формат</Label>
          <select
            className="h-9 border border-border bg-background px-2 text-sm"
            defaultValue=""
            onChange={(e) => applyPreset(e.target.value)}
            disabled={!canEdit}
          >
            <option value="" disabled>
              Пресет…
            </option>
            {PAGE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        {[
          ["Ширина, мм", pageWidthMm, setW],
          ["Высота, мм", pageHeightMm, setH],
          ["Поля, мм", marginMm, setM],
          ["Кегль, pt", fontSizePt, setFs],
        ].map(([label, val, set]) => (
          <div key={label as string}>
            <Label>{label as string}</Label>
            <Input
              type="number"
              className="w-24"
              value={val as number}
              onChange={(e) => (set as (n: number) => void)(Number(e.target.value))}
              disabled={!canEdit}
            />
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <div className="border border-border bg-card">
          <div className="flex flex-wrap gap-1 border-b border-border p-2">
            {[
              ["B", () => editor?.chain().focus().toggleBold().run()],
              ["I", () => editor?.chain().focus().toggleItalic().run()],
              ["U", () => editor?.chain().focus().toggleUnderline().run()],
              ["H2", () => editor?.chain().focus().toggleHeading({ level: 2 }).run()],
              ["≡", () => editor?.chain().focus().setTextAlign("left").run()],
              ["≣", () => editor?.chain().focus().setTextAlign("center").run()],
              ["≡›", () => editor?.chain().focus().setTextAlign("right").run()],
              ["табл", () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()],
              ["img", () => fileRef.current?.click()],
            ].map(([label, fn]) => (
              <button
                key={label as string}
                type="button"
                className="border border-border px-2 py-1 font-mono text-[10px] uppercase disabled:opacity-40"
                onClick={fn as () => void}
                disabled={!canEdit || sourceMode}
              >
                {label as string}
              </button>
            ))}
            <button
              type="button"
              className={cn("ml-auto border border-border px-2 py-1 font-mono text-[10px] uppercase", sourceMode && "bg-foreground text-background")}
              onClick={() => {
                if (!sourceMode) setSource(editor?.getHTML() ?? source);
                else editor?.commands.setContent(source);
                setSourceMode((v) => !v);
              }}
            >
              {"</>"} исходник
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImage(f);
                e.target.value = "";
              }}
            />
          </div>
          <div className="bg-[#e5e7eb] p-4">
            <div
              className="mx-auto overflow-auto bg-white shadow"
              style={{
                width: `${pageWidthMm}mm`,
                minHeight: `${Math.min(pageHeightMm, 297)}mm`,
                padding: `${marginMm}mm`,
                fontSize: `${fontSizePt}pt`,
              }}
            >
              {sourceMode ? (
                <textarea
                  className="min-h-[420px] w-full resize-y border-0 font-mono text-xs outline-none"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  disabled={!canEdit}
                />
              ) : (
                <EditorContent editor={editor} />
              )}
            </div>
          </div>
        </div>

        <aside className="border border-border bg-card">
          <div className="border-b border-border p-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Переменные</p>
            <Input className="mt-2" placeholder="Поиск…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="max-h-[70vh] overflow-auto">
            {groups.map((g) => (
              <div key={g.id} className="border-b border-border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => setOpenGroup(openGroup === g.id ? null : g.id)}
                >
                  {g.title}
                  <span className="font-mono text-[10px] text-muted-foreground">{openGroup === g.id ? "−" : "+"}</span>
                </button>
                {openGroup === g.id ? (
                  <ul className="pb-2">
                    {g.vars.map((v) => (
                      <li key={v.name}>
                        <button
                          type="button"
                          className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent disabled:opacity-50"
                          onClick={() => insertVar(v.name)}
                          disabled={!canEdit}
                          title={v.example}
                        >
                          <span className="font-mono text-[11px]">&lt;{v.name}&gt;</span>
                          <span className="mt-0.5 block text-muted-foreground">{v.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
          <div className="border-t border-border p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Изображения</p>
            <button
              type="button"
              className="mt-2 w-full border border-dashed border-border px-3 py-6 text-xs text-muted-foreground hover:bg-accent"
              onClick={() => fileRef.current?.click()}
              disabled={!canEdit}
            >
              Добавить файл или перетащите его сюда
            </button>
          </div>
        </aside>
      </div>

    </div>
  );
}
