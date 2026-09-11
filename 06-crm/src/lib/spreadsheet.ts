import * as XLSX from "xlsx";
import { parseExcelCsv } from "@/lib/excel-csv";

/** Таблица из CSV/TSV текста или бинарного Excel (.xlsx / .xls). */
export function parseSpreadsheetBuffer(buf: ArrayBuffer | Uint8Array, fileName?: string): string[][] {
  const name = (fileName ?? "").toLowerCase();
  const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".xlsm");
  if (isExcel) {
    const wb = XLSX.read(buf, { type: "array", cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    return rows.map((r) => r.map((c) => String(c ?? "").trim()));
  }
  const text = new TextDecoder("utf-8").decode(buf);
  return parseExcelCsv(text);
}

export function parseSpreadsheetFile(file: File): Promise<string[][]> {
  return file.arrayBuffer().then((buf) => parseSpreadsheetBuffer(buf, file.name));
}
