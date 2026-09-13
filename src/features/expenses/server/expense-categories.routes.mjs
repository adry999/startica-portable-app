import { fail } from '#core/server/errors/domain-error.mjs';

/** @typedef {import('../expenses.types.mjs').ExpenseCategoriesRoutesDependencies} ExpenseCategoriesRoutesDependencies */
/** @typedef {import('../expenses.types.mjs').CategoryDeleteRequest} CategoryDeleteRequest */

const TRANSACTION_ACTION = 'ștergere categorie';
const AUDIT_ACTION = 'ștergere';

/** @param {ExpenseCategoriesRoutesDependencies} dependencies */
export function createExpenseCategoriesRoutes({ recordRepository, auditTrail, runRevisionTransaction }) {
  return [
    {
      method: 'POST',
      path: '/api/category-delete',
      /** @param {{ body: CategoryDeleteRequest }} request */
      handle: ({ body }) =>
        runRevisionTransaction(body, { action: TRANSACTION_ACTION, backupBefore: false }, () => {
          const category = recordRepository.find('categories', body.id);
          if (!category) fail('Categoria nu mai există.', 409);
          // Categoria e doar o etichetă text pentru cheltuieli (fără FK), deci ștergerea nu are
          // nevoie de verificare de ocupare, ca la grupe.
          recordRepository.remove('categories', body.id);
          auditTrail.recordChange({
            action: AUDIT_ACTION,
            recordType: 'categories',
            recordId: body.id,
            before: category,
            after: null,
          });
        }),
    },
  ];
}
