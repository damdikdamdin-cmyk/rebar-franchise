"use client";

import { toExcelCsv } from "@/lib/excel-csv";

export function ExcelExportButton({
  filename,
  headers,
  rows,
  label = "Экспорт",
}: {
  filename: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
  label?: string;
}) {
  function download() {
    const csv = toExcelCsv(headers, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex h-9 items-center border border-border bg-card px-3 font-mono text-[10px] uppercase tracking-[0.12em]"
    >
      {label} Excel
    </button>
  );
}
