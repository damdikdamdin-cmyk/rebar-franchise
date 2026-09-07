export function rub(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";
}
