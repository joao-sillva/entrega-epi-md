import { AVATAR_COLORS, NAME_CONNECTORS } from '../config/constants.js';

const DIACRITICS_PATTERN = /[̀-ͯ]/g;

export function removeAccents(text) {
  return String(text).normalize('NFD').replace(DIACRITICS_PATTERN, '');
}

/**
 * Capitalizes each word of a name ("maria da silva" -> "Maria da Silva").
 * Words containing digits are upper-cased and connectors stay lowercase.
 */
export function capitalizeName(text) {
  return text.toLowerCase().replace(/\S+/g, (word, position) => {
    if (/\d/.test(word)) return word.toUpperCase();
    if (position > 0 && NAME_CONNECTORS.includes(word)) return word;
    return word[0].toUpperCase() + word.slice(1);
  });
}

/** Lowercase, accent-free, single-spaced key used to compare PPE names. */
export function normalizeComparisonKey(text) {
  return removeAccents(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Turns free text into a file-name friendly slug ("Luva de Segurança" -> "luva-de-seguranca"). */
export function toSlug(text) {
  return removeAccents(text)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/** Initials of the first two words ("maria da silva" -> "MD"). */
export function getInitials(fullName) {
  return String(fullName || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

/** Deterministic avatar color pair for a given name. */
export function getAvatarColors(name) {
  const hash = [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function pluralize(count, singular, plural) {
  return count === 1 ? singular : plural;
}
