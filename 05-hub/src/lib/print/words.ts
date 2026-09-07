const ONES = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const ONES_F = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

function plural(n: number, forms: [string, string, string]) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1];
  return forms[2];
}

function triad(n: number, feminine: boolean) {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  if (h) parts.push(HUNDREDS[h]);
  if (t === 1) parts.push(TEENS[o]);
  else {
    if (t) parts.push(TENS[t]);
    if (o) parts.push((feminine ? ONES_F : ONES)[o]);
  }
  return parts.join(" ");
}

/** 79990 → «семьдесят девять тысяч девятьсот девяносто рублей 00 копеек» */
export function rubInWords(amount: number) {
  const rubles = Math.floor(Math.abs(amount));
  const kop = Math.round((Math.abs(amount) - rubles) * 100);
  if (rubles === 0) return `ноль рублей ${String(kop).padStart(2, "0")} копеек`;
  const groups: Array<[number, [string, string, string] | null, boolean]> = [
    [Math.floor(rubles / 1_000_000_000) % 1000, ["миллиард", "миллиарда", "миллиардов"], false],
    [Math.floor(rubles / 1_000_000) % 1000, ["миллион", "миллиона", "миллионов"], false],
    [Math.floor(rubles / 1000) % 1000, ["тысяча", "тысячи", "тысяч"], true],
    [rubles % 1000, null, false],
  ];
  const words: string[] = [];
  for (const [n, forms, fem] of groups) {
    if (!n) continue;
    words.push(triad(n, fem));
    if (forms) words.push(plural(n, forms));
  }
  words.push(plural(rubles, ["рубль", "рубля", "рублей"]));
  return `${words.join(" ")} ${String(kop).padStart(2, "0")} ${plural(kop, ["копейка", "копейки", "копеек"])}`;
}
