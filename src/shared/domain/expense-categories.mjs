import { stripDiacritics } from '#shared/format/text-search.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').ExpenseCategory} ExpenseCategory */

// Semințele categoriilor de cheltuieli — în shared/domain (nu în features/expenses), ca
// upgradeSnapshot() (import, restaurare) să le poată aplica fără să încalce granița
// „shared nu importă features” (vezi record-snapshot-upgrade.mjs).

// „General” e categoria de rezervă: implicitul unei cheltuieli noi și destinația
// cheltuielilor rămase fără categorie (ștergerea categoriei lor sau date vechi fără
// categorie). Id fix — nu doar numele — ca redenumirea ei să rămână detectabilă
// indiferent de text, și ca două calculatoare care seamănă aceeași categorie de
// rezervă (înainte de prima sincronizare) să producă aceeași înregistrare.
export const GENERAL_CATEGORY_ID = 'CAT-general';
export const GENERAL_CATEGORY_NAME = 'General';

// Semințele categoriilor implicite: id-uri fixe, ca două calculatoare care le seamănă
// independent să nu inventeze înregistrări diferite pentru același nume (sincronizarea
// le-ar trata ca un conflict).
export const DEFAULT_EXPENSE_CATEGORY_SEEDS = [
  { id: 'CAT-chirie', name: 'Chirie' },
  { id: 'CAT-utilitati', name: 'Utilități' },
  { id: 'CAT-salarii', name: 'Salarii' },
  { id: 'CAT-materiale-educationale', name: 'Materiale educaționale' },
  { id: 'CAT-alimente', name: 'Alimente' },
  { id: 'CAT-reparatii-intretinere', name: 'Reparații și întreținere' },
  { id: 'CAT-altele', name: 'Altele' },
  { id: GENERAL_CATEGORY_ID, name: GENERAL_CATEGORY_NAME },
];

// Exportat (m6 din audit): ștergerea/redenumirea unei categorii (expense-categories.routes.mjs)
// trebuie să găsească cheltuielile cu același nume, cu diacritice/majuscule diferite (import,
// date vechi) — nu doar potrivirea exactă de string.
export const comparable = name => stripDiacritics(name).toLocaleLowerCase('ro-RO');

// Slug determinist pentru id-ul categoriilor „orfane” (nume folosit doar pe o cheltuială,
// fără categorie proprie) — vezi missingExpenseOnlyCategorySeeds. Fără diacritice, litere
// mici, separator „-”, ca branchSlug din #shared/domain/branch.mjs.
function categorySlug(name) {
  const base = stripDiacritics(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'categorie';
}

/**
 * Semințele implicite lipsă — active doar cât timp „General” nu există încă, adică o
 * singură dată per filială (id fix, nu poate fi ștearsă — vezi expense-categories.routes.mjs
 * — deci prezența ei e un semnal sigur că semințele au rulat deja). Fără acest prag, o
 * categorie implicită ștearsă deliberat de operator (ex. „Chirie”, la o grădiniță care nu
 * plătește chirie) ar reapărea la fiecare pornire — contrar cerinței ca toate categoriile
 * să fie „reale și gestionabile”, nu doar semințele resuscitate mereu.
 * @param {RecordsSnapshot} records
 * @returns {ExpenseCategory[]}
 */
export function missingDefaultCategorySeeds(records) {
  if (records.categories.some(category => category.id === GENERAL_CATEGORY_ID)) return [];
  const knownNames = new Set(records.categories.map(category => comparable(category.name)));
  return DEFAULT_EXPENSE_CATEGORY_SEEDS.filter(seed => !knownNames.has(comparable(seed.name)));
}

/**
 * Categoriile lipsă pentru numele folosite deja de cheltuieli fără înregistrare
 * corespunzătoare (perioada în care categoria era doar text pe cheltuială) — ca nimic
 * să nu rămână „în aer”. Se recalculează de fiecare dată (nu doar o dată), fiindcă o
 * cheltuială cu un nume nou de categorie poate apărea oricând (import, restaurare).
 * Id determinist din nume (B-2 din audit): două calculatoare cu aceeași cheltuială
 * „orfană” (import, aceleași date vechi) trebuie să producă aceeași înregistrare, nu
 * una cu id aleator fiecare — altfel sincronizarea le-ar trata ca un conflict fals.
 * @param {RecordsSnapshot} records
 * @returns {ExpenseCategory[]}
 */
export function missingExpenseOnlyCategorySeeds(records) {
  const known = new Set(records.categories.map(category => comparable(category.name)));
  const migratedFromExpenses = [];
  for (const expense of records.expenses) {
    const name = String(expense.category || '').trim();
    if (!name || known.has(comparable(name))) continue;
    known.add(comparable(name));
    migratedFromExpenses.push({ id: `CAT-${categorySlug(name)}`, name });
  }
  return migratedFromExpenses;
}
