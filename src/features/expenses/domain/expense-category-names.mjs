/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */

// Sugestii de bază pt. categoria de cheltuieli — nu o listă închisă, clientul
// poate scrie oricând una nouă (vezi expense-categories.controller.mjs).
export const DEFAULT_EXPENSE_CATEGORIES = [
  'Chirie',
  'Utilități',
  'Salarii',
  'Materiale educaționale',
  'Alimente',
  'Reparații și întreținere',
  'Altele',
];

/** @param {RecordsSnapshot} records */
export function listExpenseCategoryNames(records) {
  return [
    ...new Set([
      ...DEFAULT_EXPENSE_CATEGORIES,
      ...records.categories.map(category => category.name),
      ...records.expenses.map(expense => expense.category).filter(Boolean),
    ]),
  ].sort((a, b) => a.localeCompare(b, 'ro'));
}
