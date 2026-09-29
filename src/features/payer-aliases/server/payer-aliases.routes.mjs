import { fail } from '#core/server/errors/domain-error.mjs';

/** @typedef {import('../payer-aliases.types.mjs').PayerAliasesRoutesDependencies} PayerAliasesRoutesDependencies */
/** @typedef {import('../payer-aliases.types.mjs').PayerAliasDeleteRequest} PayerAliasDeleteRequest */

const TRANSACTION_ACTION = 'ștergere plătitor reținut';
const AUDIT_ACTION = 'ștergere';

// Creare: prin /api/record generic (mode: 'create'), ca orice alt tip din TYPES — record-editing
// evită duplicatele alias+copil acolo. Ștergere: rută proprie, ca la groups/categories, pentru că
// un alias nu se arhivează (nu e o înregistrare financiară) — se șterge direct, fără pasul
// „arhivat mai întâi” din /api/record-delete.
/** @param {PayerAliasesRoutesDependencies} dependencies */
export function createPayerAliasesRoutes({ recordRepository, auditTrail, runRevisionTransaction }) {
  return [
    {
      method: 'POST',
      path: '/api/payer-alias-delete',
      /** @param {{ body: PayerAliasDeleteRequest }} request */
      handle: ({ body }) =>
        runRevisionTransaction(body, { action: TRANSACTION_ACTION, backupBefore: false }, () => {
          const alias = recordRepository.find('payerAliases', body.id);
          if (!alias) fail('Plătitorul reținut nu mai există.', 409);
          recordRepository.remove('payerAliases', body.id);
          auditTrail.recordChange({
            action: AUDIT_ACTION,
            recordType: 'payerAliases',
            recordId: body.id,
            before: alias,
            after: null,
          });
        }),
    },
  ];
}
