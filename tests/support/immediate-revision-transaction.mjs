/** @typedef {import('#shared/contracts/persistence.mjs').RecordRepository} RecordRepository */
/** @typedef {import('#shared/contracts/persistence.mjs').RevisionRequest} RevisionRequest */
/** @typedef {import('#shared/contracts/persistence.mjs').RevisionTransactionOptions} RevisionTransactionOptions */
/** @typedef {import('#shared/contracts/persistence.mjs').RunRevisionTransaction} RunRevisionTransaction */

// Fără rollback și fără idempotență: acelea sunt garanțiile din core, testate acolo, nu în feature-uri.
/** @param {RecordRepository} recordRepository */
export function createImmediateRevisionTransaction(recordRepository) {
  /** @type {{ request: RevisionRequest, options: RevisionTransactionOptions }[]} */
  const calls = [];

  /** @type {RunRevisionTransaction} */
  const run = (request, options, applyChanges) => {
    calls.push({ request, options });
    applyChanges();
    return {
      ok: true,
      state: recordRepository.readSnapshot(),
      revision: request.revision + 1,
      updatedAt: new Date().toISOString(),
    };
  };

  return { run, calls };
}
