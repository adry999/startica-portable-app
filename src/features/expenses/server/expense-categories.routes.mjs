import { fail } from '#core/server/errors/domain-error.mjs';
import { assertUniqueName } from '#shared/domain/record-integrity.mjs';
import { GENERAL_CATEGORY_ID, GENERAL_CATEGORY_NAME } from '#shared/domain/expense-categories.mjs';
import { seedExpenseCategories } from './expense-category-seeding.mjs';

/** @typedef {import('../expenses.types.mjs').ExpenseCategoriesRoutesDependencies} ExpenseCategoriesRoutesDependencies */
/** @typedef {import('../expenses.types.mjs').CategoryDeleteRequest} CategoryDeleteRequest */
/** @typedef {import('../expenses.types.mjs').CategoryRenameRequest} CategoryRenameRequest */

const DELETE_TRANSACTION_ACTION = 'ștergere categorie';
const RENAME_TRANSACTION_ACTION = 'redenumire categorie';
const AUDIT_DELETE = 'ștergere';
const AUDIT_RENAME = 'modificare';
// Distinct de „modificare” (o editare directă a cheltuielii): aici cheltuiala nu s-a
// schimbat prin voința operatorului asupra ei, ci fiindcă categoria ei a fost ștearsă.
const AUDIT_MOVED_TO_GENERAL = 'mutare la General';

const GENERAL_UNDELETABLE_MESSAGE =
  'Categoria „General” nu poate fi ștearsă — e destinația cheltuielilor rămase fără categorie.';
const GENERAL_UNRENAMEABLE_MESSAGE =
  'Categoria „General” nu poate fi redenumită — rămâne destinația cheltuielilor fără categorie.';

/** @param {ExpenseCategoriesRoutesDependencies} dependencies */
export function createExpenseCategoriesRoutes({ recordRepository, auditTrail, runRevisionTransaction }) {
  // Semințele (întrebarea „toate categoriile trebuie să fie reale”): scrise sincron la
  // construcția rutelor, la fel ca semințele Personal 24 — vezi expense-category-seeding.mjs.
  seedExpenseCategories(recordRepository);

  /** @param {string} categoryName */
  function expensesUsingCategory(categoryName) {
    return recordRepository.readSnapshot().expenses.filter(expense => expense.category === categoryName);
  }

  return [
    {
      method: 'POST',
      path: '/api/category-delete',
      /** @param {{ body: CategoryDeleteRequest }} request */
      handle: ({ body }) =>
        // backupBefore: ștergerea mută și cheltuielile categoriei la General, în aceeași
        // tranzacție — poate rescrie multe înregistrări, deci e ireversibilă ca orice ștergere.
        runRevisionTransaction(body, { action: DELETE_TRANSACTION_ACTION, backupBefore: true }, () => {
          const category = recordRepository.find('categories', body.id);
          if (!category) fail('Categoria nu mai există.', 409);
          if (category.id === GENERAL_CATEGORY_ID) fail(GENERAL_UNDELETABLE_MESSAGE);

          // Nimic nu rămâne „în aer”: fiecare cheltuială a categoriei șterse trece la General.
          for (const expense of expensesUsingCategory(category.name)) {
            const moved = { ...expense, category: GENERAL_CATEGORY_NAME };
            recordRepository.save('expenses', moved);
            auditTrail.recordChange({
              action: AUDIT_MOVED_TO_GENERAL,
              recordType: 'expenses',
              recordId: expense.id,
              before: expense,
              after: moved,
            });
          }

          recordRepository.remove('categories', body.id);
          auditTrail.recordChange({
            action: AUDIT_DELETE,
            recordType: 'categories',
            recordId: body.id,
            before: category,
            after: null,
          });
        }),
    },
    {
      method: 'POST',
      path: '/api/category-rename',
      /** @param {{ body: CategoryRenameRequest }} request */
      handle: ({ body }) =>
        // backupBefore: redenumirea propagă noul nume la toate cheltuielile categoriei, în
        // aceeași tranzacție — poate rescrie multe înregistrări, la fel ca ștergerea.
        runRevisionTransaction(body, { action: RENAME_TRANSACTION_ACTION, backupBefore: true }, () => {
          const category = recordRepository.find('categories', body.id);
          if (!category) fail('Categoria nu mai există.', 409);
          const name = String(body.name || '').trim();
          if (!name) fail('Numele categoriei este obligatoriu.');
          if (name === category.name) return;
          if (category.id === GENERAL_CATEGORY_ID) fail(GENERAL_UNRENAMEABLE_MESSAGE);

          const renamed = { ...category, name };
          assertUniqueName('categories', renamed, recordRepository.readSnapshot());
          recordRepository.save('categories', renamed);
          auditTrail.recordChange({
            action: AUDIT_RENAME,
            recordType: 'categories',
            recordId: category.id,
            before: category,
            after: renamed,
          });

          // Categoria e doar o etichetă text pe cheltuială (fără FK) — redenumirea trebuie
          // propagată manual, ca o cheltuială să nu rămână cu numele vechi, nemaifiind
          // vizibilă sub noua categorie (filtru, raport contabil).
          for (const expense of expensesUsingCategory(category.name)) {
            const moved = { ...expense, category: name };
            recordRepository.save('expenses', moved);
            auditTrail.recordChange({
              action: AUDIT_RENAME,
              recordType: 'expenses',
              recordId: expense.id,
              before: expense,
              after: moved,
            });
          }
        }),
    },
  ];
}
