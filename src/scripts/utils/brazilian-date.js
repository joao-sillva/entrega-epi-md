/** Helpers for dates typed as dd/mm/aaaa (the filters store them as yyyy-mm-dd). */

/** Keeps only digits and inserts the slashes while the user types ("1910" -> "19/10"). */
export function maskBrazilianDate(typedText) {
  const digits = typedText.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** "19/10/2026" -> "2026-10-19"; returns null when the text is not a real date. */
export function parseBrazilianDate(text) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [, day, month, year] = match.map(Number);
  const date = new Date(year, month - 1, day);
  const isRealDate = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return isRealDate ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

/** "2026-10-19" -> "19/10/2026" (empty stays empty). */
export const formatBrazilianDate = (isoDay) => (isoDay ? isoDay.split('-').reverse().join('/') : '');
