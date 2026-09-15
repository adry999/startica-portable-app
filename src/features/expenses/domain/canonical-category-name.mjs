import { stripDiacritics } from '#shared/format/text-search.mjs';
import { listExpenseCategoryNames } from './expense-category-names.mjs';

const comparable = name => stripDiacritics(name).toLocaleLowerCase('ro-RO');

// „bucatarie” tastat fără diacritice nu trebuie să creeze o categorie separată de „Bucătărie”.
/**
 * @param {string} typed
 * @param {any} records
 * @returns {string}
 */
export function canonicalCategoryName(typed, records) {
  const trimmed = String(typed || '').trim();
  if (!trimmed) return trimmed;
  const key = comparable(trimmed);
  return listExpenseCategoryNames(records).find(name => comparable(name) === key) ?? trimmed;
}
