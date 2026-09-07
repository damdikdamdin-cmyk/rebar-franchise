import bwipjs from "bwip-js/node";
import { ALL_VARS, LINE_VARS } from "./variables";

export type PrintContext = {
  /** Значения переменных документа */
  doc: Record<string, string>;
  /** Строки таблицы (каждая — свои значения line-переменных) */
  lines: Array<Record<string, string>>;
  /** Данные для штрихкодов: имя переменной → текст */
  barcodes: Record<string, string>;
};

/** <Имя> или <Имя(параметр)> — в HTML редактора угловые скобки экранированы. */
const TOKEN = /(?:&lt;|<)([А-ЯЁа-яёA-Za-z0-9_№]+)(?:\(([^)&<>]*)\))?(?:&gt;|>)/g;
const TR = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;

function esc(s: string) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function parseSize(param: string | undefined, fallback: { w: number; h: number }) {
  if (!param) return fallback;
  const m = param.match(/^(\d+)(px|mm)?\s*[:x×]\s*(\d+)(px|mm)?$/i);
  if (!m) return fallback;
  const toPx = (n: string, unit: string | undefined) => (unit?.toLowerCase() === "mm" ? Math.round(Number(n) * 3.78) : Number(n));
  return { w: toPx(m[1], m[2]), h: toPx(m[3], m[4]) };
}

function barcodeSvg(kind: "code128" | "ean13" | "qrcode", text: string, size: { w: number; h: number }) {
  if (!text) return "";
  try {
    const svg = bwipjs.toSVG({
      bcid: text.length === 13 && /^\d+$/.test(text) && kind !== "qrcode" ? "ean13" : kind,
      text,
      scale: 2,
      height: kind === "qrcode" ? undefined : Math.max(4, Math.round(size.h / 6)),
      includetext: kind !== "qrcode",
      textxalign: "center",
    });
    return svg.replace("<svg", `<svg style="width:${size.w}px;height:${size.h}px;display:inline-block" preserveAspectRatio="xMidYMid meet"`);
  } catch {
    return `<span style="font-family:monospace">${esc(text)}</span>`;
  }
}

function resolveToken(name: string, param: string | undefined, values: Record<string, string>, ctx: PrintContext): string {
  switch (name) {
    case "Штрихкод":
    case "ШтрихкодСтроки":
    case "ШтрихкодIMEI": {
      const text = values[name] ?? ctx.barcodes[name] ?? "";
      return barcodeSvg("code128", text, parseSize(param, { w: 180, h: 48 }));
    }
    case "ШтрихкодКод": {
      const text = values[name] ?? ctx.barcodes[name] ?? "";
      return barcodeSvg("ean13", text, parseSize(param, { w: 160, h: 56 }));
    }
    case "QR": {
      const text = values[name] ?? ctx.barcodes[name] ?? "";
      return barcodeSvg("qrcode", text, parseSize(param, { w: 72, h: 72 }));
    }
    case "Логотип":
      return `<span style="font-family:'Rebar Display',sans-serif;font-size:1.6em;letter-spacing:-0.02em">re:bar</span>`;
    case "ЛинияПодписи":
      return "____________________";
    case "Страница":
      return `<div style="page-break-after:always;break-after:page"></div>`;
    default: {
      const v = values[name];
      if (v === undefined) return "";
      return esc(v);
    }
  }
}

function replaceTokens(fragment: string, values: Record<string, string>, ctx: PrintContext) {
  // Неизвестные имена (в т.ч. HTML-теги вида <table>) оставляем как есть
  return fragment.replace(TOKEN, (m, name: string, param?: string) => (ALL_VARS.has(name) ? resolveToken(name, param, values, ctx) : m));
}

function hasLineVar(fragment: string) {
  let found = false;
  fragment.replace(TOKEN, (m, name: string) => {
    if (LINE_VARS.has(name) && name !== "Наименование") found = true;
    if (name === "Наименование" && /(?:&lt;|<)(Кол|Цена|Сумма|Код|SN|№)(?:\(|&gt;|>)/.test(fragment)) found = true;
    return m;
  });
  return found;
}

/** Подставить данные в HTML шаблона. Строки таблиц с line-переменными размножаются по позициям. */
export function renderTemplate(html: string, ctx: PrintContext) {
  const withRows = html.replace(TR, (row) => {
    if (!ctx.lines.length || !hasLineVar(row)) return row;
    return ctx.lines
      .map((line, i) => replaceTokens(row, { ...ctx.doc, ...line, "№": String(i + 1) }, ctx))
      .join("");
  });
  return replaceTokens(withRows, ctx.doc, ctx);
}

/** Пример данных для предпросмотра в редакторе. */
export function sampleContext(scope?: string): PrintContext {
  const doc: Record<string, string> = {
    НомерДокумента: "S000123",
    ДатаВыдачи: "07.09.2026",
    ДатаВремя: "07.09.2026 14:32",
    ТекущаяДата: new Date().toLocaleDateString("ru-RU"),
    Комментарий: "",
    СпособОплаты: "Наличные",
    Поставщик: "ООО «Поставка»",
    НазваниеКомпании: "ИП Цыпылова Сарюна Баяржаповна",
    ИНН: "0323000000",
    ОГРН: "320030000000000",
    ЮрАдрес: "г. Улан-Удэ, ул. Ленина, 1",
    НазваниеЛокации: "re:bar Улан-Удэ",
    АдресЛокации: "ул. Ленина, 1",
    ТелефонЛокации: "+7 (3012) 00-00-00",
    Город: "Улан-Удэ",
    Контрагент: "Иванов Иван Иванович",
    ТелефонКонтрагента: "+7 999 000-00-00",
    ПаспортКонтрагента: "серия ____ № ______",
    АдресКонтрагента: "______________________",
    Марка: "Apple",
    Модель: "iPhone 15 128GB Black",
    IMEI: "351234567890123",
    Гарант: "12 мес.",
    ГарантДо: "07.09.2027",
    Комплектность: "телефон, кабель, коробка",
    Неисправность: "не включается",
    Наименование: "iPhone 15 128GB Black",
    КодТовара: "512",
    Артикул: "MTP03",
    Группа: "Apple",
    Розничная: "79 990",
    Закупочная: "70 000",
    Ремонтная: "75 000",
    ПодЗаказ: "78 000",
    Остаток: "3",
    Влт: "₽",
    Сотрудник: "Петрова Анна",
    ТелефонСотрудника: "seller@rebar.local",
    Итого: "79 990",
    ИтогоБезСкидки: "84 990",
    Скидка: "5 000",
    Кредит: "0",
    Оплачено: "79 990",
    ИтогоПрописью: "семьдесят девять тысяч девятьсот девяносто рублей 00 копеек",
    КолПозиций: "2",
  };
  const withLines = !scope || scope === "sale" || scope === "stock_doc";
  return {
    doc,
    lines: !withLines ? [] : [
      { Код: "512", Наименование: "iPhone 15 128GB Black", SN: "351234567890123", Кол: "1", Ед: "шт", Цена: "79 990", СкидкаСтроки: "5 000", Сумма: "74 990", ГарантДо: "07.09.2027", ГарантСрок: "12 мес.", ШтрихкодСтроки: "2000000005126" },
      { Код: "301", Наименование: "Чехол MagSafe", SN: "", Кол: "1", Ед: "шт", Цена: "5 000", СкидкаСтроки: "0", Сумма: "5 000", ГарантДо: "07.03.2027", ГарантСрок: "6 мес.", ШтрихкодСтроки: "2000000003016" },
    ],
    barcodes: { Штрихкод: "S000123", ШтрихкодКод: "2000000005126", ШтрихкодIMEI: "351234567890123", QR: "https://rebar.pro" },
  };
}
