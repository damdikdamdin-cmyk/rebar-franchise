/** Только цифры из строки телефона / поиска. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Нормализация для сохранения: оставляем цифры, без пробелов и «+». */
export function normalizePhone(value: string): string {
  return digitsOnly(value);
}
