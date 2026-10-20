export const padTwoDigits = (number) => String(number).padStart(2, '0');

/** "19/10/2026" */
export function formatDate(date) {
  return `${padTwoDigits(date.getDate())}/${padTwoDigits(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** "19/10/2026 20:48", or an empty string when there is no date. */
export function formatDateTime(date) {
  if (!date) return '';
  return `${formatDate(date)} ${padTwoDigits(date.getHours())}:${padTwoDigits(date.getMinutes())}`;
}

/** "19/10/2026  20:48:05" (with seconds), printed on the delivery photo. */
export function formatDateTimeWithSeconds(date) {
  const time = [date.getHours(), date.getMinutes(), date.getSeconds()].map(padTwoDigits).join(':');
  return `${formatDate(date)}  ${time}`;
}

/** "2026-10-19", used for date inputs, month keys and file names. */
export function toIsoDate(date) {
  return `${date.getFullYear()}-${padTwoDigits(date.getMonth() + 1)}-${padTwoDigits(date.getDate())}`;
}

/** "2026-10", used to filter the outflow history by month. */
export function toMonthKey(date) {
  return `${date.getFullYear()}-${padTwoDigits(date.getMonth() + 1)}`;
}

/** Date and time as stored on each delivered PPE line ("19/10/26 20:48"). */
export function formatDeliveryTimestampText(date = new Date()) {
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Reads "dd/mm/yyyy" with an optional "HH:MM" from free text.
 * Returns a Date or null when the text has no recognizable date.
 */
export function parseDayMonthYearText(text) {
  const match = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\D+(\d{1,2}):(\d{2}))?/.exec(text || '');
  if (!match) return null;
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  return new Date(year, Number(match[2]) - 1, Number(match[1]), Number(match[4]) || 0, Number(match[5]) || 0);
}

/** Reads a validity date written as "dd/mm/yyyy" or "yyyy-mm-dd" (end of that day). */
export function parseValidityDate(text) {
  const brazilian = /(\d{2})\/(\d{2})\/(\d{4})/.exec(text || '');
  if (brazilian) return new Date(Number(brazilian[3]), Number(brazilian[2]) - 1, Number(brazilian[1]), 23, 59);
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(text || '');
  return iso ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 23, 59) : null;
}

/** Formats a UTC timestamp as a Brazilian date. */
export function formatUtcDate(timestamp) {
  return timestamp ? new Date(timestamp).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '';
}

export function formatLocalDateTimeShort(timestamp) {
  return new Date(timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
