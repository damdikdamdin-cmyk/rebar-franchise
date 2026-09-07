/**
 * Переменные печатных форм. В шаблоне пишутся как <Имя> или <Имя(параметр)>,
 * как в LiveSklad. Параметр: для сумм — формат (#.##), для штрихкода — размер (120px:20px).
 *
 * scope — где переменная имеет смысл:
 *  doc   — шапка/подвал документа (один раз)
 *  line  — строка таблицы товаров: <tr>, где встречаются такие переменные, повторяется по позициям
 */
export type PrintScope = "sale" | "product" | "stock_doc" | "customer" | "free";

export type PrintVariable = {
  name: string;
  label: string;
  /** Для каких типов шаблонов показывать в панели (пусто — во всех) */
  scopes?: PrintScope[];
  line?: boolean;
  example: string;
};

export type VariableGroup = { id: string; title: string; vars: PrintVariable[] };

export const VARIABLE_GROUPS: VariableGroup[] = [
  {
    id: "document",
    title: "Документ",
    vars: [
      { name: "НомерДокумента", label: "Номер документа", example: "S000123" },
      { name: "ДатаВыдачи", label: "Дата документа", example: "07.09.2026" },
      { name: "ДатаВремя", label: "Дата и время", example: "07.09.2026 14:32" },
      { name: "ТекущаяДата", label: "Сегодняшняя дата", example: "07.09.2026" },
      { name: "Комментарий", label: "Комментарий к документу", example: "" },
      { name: "СпособОплаты", label: "Способ оплаты", scopes: ["sale"], example: "Наличные" },
      { name: "Поставщик", label: "Поставщик", scopes: ["stock_doc"], example: "ООО «Поставка»" },
    ],
  },
  {
    id: "company",
    title: "Компания",
    vars: [
      { name: "НазваниеКомпании", label: "Юрлицо / ИП", example: "ИП Цыпылова С.Б." },
      { name: "ИНН", label: "ИНН", example: "0323000000" },
      { name: "ОГРН", label: "ОГРН / ОГРНИП", example: "3200300000000" },
      { name: "ЮрАдрес", label: "Юридический адрес", example: "г. Улан-Удэ, ул. …" },
      { name: "НазваниеЛокации", label: "Название точки", example: "re:bar Улан-Удэ" },
      { name: "АдресЛокации", label: "Адрес точки", example: "ул. Ленина, 1" },
      { name: "ТелефонЛокации", label: "Телефон точки", example: "+7 (3012) 00-00-00" },
      { name: "Город", label: "Город", example: "Улан-Удэ" },
    ],
  },
  {
    id: "customer",
    title: "Клиент",
    vars: [
      { name: "Контрагент", label: "ФИО клиента", scopes: ["sale", "customer", "free"], example: "Иванов Иван Иванович" },
      { name: "ТелефонКонтрагента", label: "Телефон клиента", scopes: ["sale", "customer", "free"], example: "+7 999 000-00-00" },
      { name: "ПаспортКонтрагента", label: "Паспорт (заполняется вручную)", scopes: ["customer", "free"], example: "____ ______" },
      { name: "АдресКонтрагента", label: "Адрес клиента (вручную)", scopes: ["customer", "free"], example: "____________" },
    ],
  },
  {
    id: "device",
    title: "Устройство",
    vars: [
      { name: "Марка", label: "Марка (группа товара)", scopes: ["sale", "product", "customer"], example: "Apple" },
      { name: "Модель", label: "Модель (наименование)", scopes: ["sale", "product", "customer"], example: "iPhone 15 128GB" },
      { name: "IMEI", label: "IMEI / серийный номер", scopes: ["sale", "product", "customer"], example: "35 123456 789012 3" },
      { name: "Гарант", label: "Срок гарантии", scopes: ["sale", "product"], example: "12 мес." },
      { name: "ГарантДо", label: "Гарантия до", scopes: ["sale", "product"], example: "07.09.2027" },
      { name: "Комплектность", label: "Комплектность (вручную)", scopes: ["customer", "free"], example: "____________" },
      { name: "Неисправность", label: "Заявленная неисправность (вручную)", scopes: ["customer", "free"], example: "____________" },
    ],
  },
  {
    id: "product",
    title: "Товар",
    vars: [
      { name: "Наименование", label: "Наименование", scopes: ["product"], example: "iPhone 15 128GB Black" },
      { name: "КодТовара", label: "Код товара", scopes: ["product"], example: "512" },
      { name: "Артикул", label: "Артикул", scopes: ["product"], example: "MTP03" },
      { name: "Группа", label: "Группа", scopes: ["product"], example: "Apple" },
      { name: "Розничная", label: "Розничная цена", scopes: ["product"], example: "79 990" },
      { name: "Закупочная", label: "Закупочная цена", scopes: ["product"], example: "70 000" },
      { name: "Ремонтная", label: "Ремонтная цена", scopes: ["product"], example: "75 000" },
      { name: "ПодЗаказ", label: "Цена под заказ", scopes: ["product"], example: "78 000" },
      { name: "Остаток", label: "Остаток на точке", scopes: ["product"], example: "3" },
      { name: "Влт", label: "Валюта", example: "₽" },
    ],
  },
  {
    id: "table",
    title: "Таблица позиций",
    vars: [
      { name: "№", label: "№ строки", line: true, scopes: ["sale", "stock_doc"], example: "1" },
      { name: "Код", label: "Код товара", line: true, scopes: ["sale", "stock_doc"], example: "512" },
      { name: "Наименование", label: "Наименование", line: true, scopes: ["sale", "stock_doc"], example: "iPhone 15 128GB" },
      { name: "SN", label: "IMEI / S/N", line: true, scopes: ["sale", "stock_doc"], example: "35 123456 789012 3" },
      { name: "Кол", label: "Количество", line: true, scopes: ["sale", "stock_doc"], example: "1" },
      { name: "Ед", label: "Единица", line: true, scopes: ["sale", "stock_doc"], example: "шт" },
      { name: "Цена", label: "Цена", line: true, scopes: ["sale", "stock_doc"], example: "79 990" },
      { name: "СкидкаСтроки", label: "Скидка по строке", line: true, scopes: ["sale"], example: "0" },
      { name: "Сумма", label: "Сумма", line: true, scopes: ["sale", "stock_doc"], example: "79 990" },
      { name: "ГарантДо", label: "Гарантия до", line: true, scopes: ["sale"], example: "07.09.2027" },
      { name: "ГарантСрок", label: "Срок гарантии", line: true, scopes: ["sale"], example: "12 мес." },
      { name: "ШтрихкодСтроки", label: "Штрихкод позиции", line: true, scopes: ["sale", "stock_doc"], example: "2000000005126" },
    ],
  },
  {
    id: "employee",
    title: "Сотрудник",
    vars: [
      { name: "Сотрудник", label: "Сотрудник (продавец)", example: "Петрова А." },
      { name: "ТелефонСотрудника", label: "Email/контакт сотрудника", example: "seller@rebar.local" },
    ],
  },
  {
    id: "finance",
    title: "Финансы",
    vars: [
      { name: "Итого", label: "Итого к оплате", scopes: ["sale", "stock_doc"], example: "79 990" },
      { name: "ИтогоБезСкидки", label: "Сумма без скидки", scopes: ["sale"], example: "84 990" },
      { name: "Скидка", label: "Скидка", scopes: ["sale"], example: "5 000" },
      { name: "Кредит", label: "Сумма в кредит (Lendo)", scopes: ["sale"], example: "0" },
      { name: "Оплачено", label: "Оплачено", scopes: ["sale", "stock_doc"], example: "79 990" },
      { name: "ИтогоПрописью", label: "Итого прописью", scopes: ["sale", "stock_doc"], example: "семьдесят девять тысяч девятьсот девяносто рублей 00 копеек" },
      { name: "КолПозиций", label: "Количество позиций", scopes: ["sale", "stock_doc"], example: "1" },
    ],
  },
  {
    id: "misc",
    title: "Разное",
    vars: [
      { name: "ЛинияПодписи", label: "Линия для подписи", example: "____________________" },
      { name: "Страница", label: "Разрыв страницы", example: "" },
    ],
  },
  {
    id: "barcode",
    title: "Штрихкод",
    vars: [
      { name: "Штрихкод", label: "Штрихкод документа (номер), Code128", scopes: ["sale", "stock_doc"], example: "S000123" },
      { name: "ШтрихкодКод", label: "Штрихкод товара, EAN-13", scopes: ["product"], example: "2000000005126" },
      { name: "ШтрихкодIMEI", label: "Штрихкод IMEI, Code128", scopes: ["product", "sale"], example: "351234567890123" },
      { name: "QR", label: "QR-код (телефон точки / номер документа)", example: "re:bar" },
    ],
  },
  {
    id: "photo",
    title: "Фото",
    vars: [{ name: "Логотип", label: "Логотип re:bar", example: "re:bar" }],
  },
];

export const ALL_VARS = new Set(VARIABLE_GROUPS.flatMap((g) => g.vars.map((v) => v.name)));

export const LINE_VARS = new Set(VARIABLE_GROUPS.flatMap((g) => g.vars.filter((v) => v.line).map((v) => v.name)));

export function variablesFor(scope: PrintScope) {
  return VARIABLE_GROUPS.map((g) => ({
    ...g,
    vars: g.vars.filter((v) => !v.scopes || v.scopes.includes(scope)),
  })).filter((g) => g.vars.length);
}

export const SCOPE_LABEL: Record<PrintScope, string> = {
  sale: "Продажа (чек, гарантия)",
  product: "Товар (ценник, этикетка)",
  stock_doc: "Складской документ (накладная)",
  customer: "Клиент и устройство (акты, договоры)",
  free: "Бланк без данных",
};

export const PAGE_PRESETS = [
  { id: "a4", label: "A4 210×297", w: 210, h: 297, margin: 12, font: 11 },
  { id: "a5", label: "A5 148×210", w: 148, h: 210, margin: 8, font: 10 },
  { id: "receipt80", label: "Чековая лента 80 мм", w: 80, h: 200, margin: 3, font: 9 },
  { id: "receipt58", label: "Чековая лента 58 мм", w: 58, h: 200, margin: 2, font: 8 },
  { id: "tag80x40", label: "Ценник 80×40", w: 80, h: 40, margin: 2, font: 9 },
  { id: "tag58x40", label: "Ценник 58×40", w: 58, h: 40, margin: 2, font: 8 },
  { id: "label43x25", label: "Этикетка 43×25", w: 43, h: 25, margin: 1, font: 7 },
  { id: "label30x20", label: "Этикетка 30×20", w: 30, h: 20, margin: 1, font: 6 },
] as const;
