/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */

// Semințele și „General” trăiesc în shared/domain (nu aici), ca upgradeSnapshot() (import,
// restaurare) să le poată aplica fără să încalce granița „shared nu importă features”.
export {
  GENERAL_CATEGORY_ID,
  GENERAL_CATEGORY_NAME,
  DEFAULT_EXPENSE_CATEGORY_SEEDS,
} from '#shared/domain/expense-categories.mjs';

/** Categoriile cunoscute — din înregistrări, plus cele folosite doar pe cheltuieli (date
 * vechi, dintre seedări), ca formularul să le poată propune înainte ca migrarea să ruleze.
 * @param {RecordsSnapshot} records
 */
export function listExpenseCategoryNames(records) {
  return [
    ...new Set([
      ...records.categories.map(category => category.name),
      ...records.expenses.map(expense => expense.category).filter(Boolean),
    ]),
  ].sort((a, b) => a.localeCompare(b, 'ro'));
}
