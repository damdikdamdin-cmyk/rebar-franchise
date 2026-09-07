/** Локальный день: from 00:00:00, to 23:59:59.999 */
export function dayRange(fromYmd?: string | null, toYmd?: string | null) {
  const today = new Date();
  const toBase = parseYmd(toYmd) ?? startOfLocalDay(today);
  const fromBase = parseYmd(fromYmd) ?? new Date(toBase.getTime() - 30 * 86400000);
  const from = startOfLocalDay(fromBase);
  const to = endOfLocalDay(toBase);
  return {
    from,
    to,
    fromYmd: toYmdInput(from),
    toYmd: toYmdInput(toBase),
  };
}

function parseYmd(value?: string | null) {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function toYmdInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** CSV для Excel (UTF-8 BOM, ; как в RU Excel) */
export function toExcelCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const body = [headers.map(esc).join(";"), ...rows.map((r) => r.map(esc).join(";"))].join("\n");
  return `\uFEFF${body}`;
}

export function parseExcelCsv(text: string) {
  const raw = text.replace(/^\uFEFF/, "").trim();
  if (!raw) return [] as string[][];
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  return lines.map((line) => {
    const cols: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ";" || ch === "\t") {
        cols.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  });
}
