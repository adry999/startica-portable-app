import { cents, total } from '#shared/domain/money.mjs';
import { allocations, paymentTenders } from '#shared/domain/payment-allocations.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').Payment} Payment */

/**
 * @param {RecordsSnapshot} records
 * @param {string} month
 */
export function summarizeCashForMonth(records, month) {
  const payments = records.payments.filter(p => !p.archived && p.date.startsWith(month));
  const income = total(payments),
    byMethod = { Cash: 0, Card: 0, Transfer: 0, Altele: 0 };
  for (const p of payments)
    for (const part of paymentTenders(p)) {
      const method = Object.hasOwn(byMethod, part.method) ? part.method : 'Altele';
      byMethod[method] += cents(part.amount);
    }
  for (const method of Object.keys(byMethod)) byMethod[method] /= 100;
  const expense = total(records.expenses.filter(p => !p.archived && p.date.startsWith(month)));
  return { income, expense, net: (cents(income) - cents(expense)) / 100, byMethod };
}

// Avans = partea dintr-o plată încasată, dar nerepartizată pe nicio lună.
/**
 * @param {Payment[]} payments
 * @param {string} asOf
 */
export function sumUnallocatedAdvance(payments, asOf) {
  return (
    payments
      .filter(p => !p.archived && p.date <= asOf)
      .reduce((sum, p) => sum + cents(p.amount) - allocations(p).reduce((n, a) => n + cents(a.amount), 0), 0) / 100
  );
}
