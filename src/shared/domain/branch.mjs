// Regulile pure ale unei filiale (Faza 6, docs/design/screens/17-filiale.md):
// izomorfe, ca să poată fi refolosite din selector și din formularul „Filiale”
// din webapp, fără duplicare de validare client/server.

export const BRANCH_COLORS = ['orange', 'mint', 'yellow', 'pink'];
export const BRANCH_NAME_MAX_LENGTH = 40;
const DEFAULT_BRANCH_COLOR = 'orange';
const SLUG_MAX_LENGTH = 30;

/**
 * @typedef {{ name: string, color?: string | null, address?: string | null }} BranchInput
 * @typedef {{ name: string, color: string, address: string }} NormalizedBranchInput
 */

/**
 * Taie spațiile, completează culoarea implicită și refuză un nume gol, prea
 * lung sau o culoare necunoscută. Aruncă `Error` simplu — ruta o traduce în
 * `fail()`, iar formularul din webapp poate folosi mesajul direct.
 * @param {BranchInput} input
 * @returns {NormalizedBranchInput}
 */
export function normalizeBranchInput({ name, color, address } = /** @type {BranchInput} */ ({})) {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) throw new Error('Numele filialei este obligatoriu.');
  if (trimmedName.length > BRANCH_NAME_MAX_LENGTH)
    throw new Error(`Numele filialei are cel mult ${BRANCH_NAME_MAX_LENGTH} de caractere.`);
  const trimmedColor = typeof color === 'string' ? color.trim() : '';
  if (trimmedColor && !BRANCH_COLORS.includes(trimmedColor)) throw new Error(`Culoare necunoscută: „${trimmedColor}”.`);
  const trimmedAddress = typeof address === 'string' ? address.trim() : '';
  return { name: trimmedName, color: trimmedColor || DEFAULT_BRANCH_COLOR, address: trimmedAddress };
}

/**
 * Primele două litere ale primului cuvânt cu litere, cu prima literă mare — sare peste cifre,
 * spații, puncte și prefixul „Filiala ” (F26, PROMPT-11 §14.1): „1 Buiucani” → „Bu”,
 * „Filiala Centru” → „Ce”, „2. Botanica” → „Bo”.
 * @param {string} name
 * @returns {string}
 */
export function branchInitials(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) return '';
  const withoutPrefix = trimmed.replace(/^filiala\s+/i, '');
  const match = withoutPrefix.match(/[a-zA-ZăâîșțĂÂÎȘȚ]+/);
  const letters = (match ? match[0] : '').slice(0, 2);
  return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
}

/**
 * Slug pentru numele folderului dintr-o filială nouă (`Filiale\<slug>`):
 * fără diacritice, litere mici, separator „-”, cel mult 30 de caractere.
 * @param {string} name
 * @returns {string}
 */
export function branchSlug(name) {
  const base = (typeof name === 'string' ? name : '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.slice(0, SLUG_MAX_LENGTH).replace(/-+$/, '');
}
