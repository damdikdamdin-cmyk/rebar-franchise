/** Красный крестик «удалено» для мягкого удаления. */
export function DeletedMark({
  at,
  who,
  compact = false,
}: {
  at?: Date | string | null;
  who?: string | null;
  compact?: boolean;
}) {
  if (!at) return null;
  const when = typeof at === "string" ? at : at.toLocaleString("ru-RU");
  const title = who ? `Удалено ${when} · ${who}` : `Удалено ${when}`;
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-red-600"
    >
      <span aria-hidden className="text-base leading-none font-bold">
        ×
      </span>
      {compact ? null : <span>удалено</span>}
    </span>
  );
}
