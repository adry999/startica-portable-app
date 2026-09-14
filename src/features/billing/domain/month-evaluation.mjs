import { today } from '#shared/domain/calendar-month.mjs';
import { paymentIndex } from '#shared/domain/payment-allocations.mjs';
import { obligation } from '#shared/domain/tuition-obligation.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */
/** @typedef {ReturnType<typeof obligation>} ChildObligation */
/** @typedef {{ child: Child, obligation: ChildObligation }} ChildMonthEvaluation */

// Dashboard, Situația plăților și De notificat au nevoie de aceiași copii
// evaluați pe aceeași lună; indexul de încasări e calculat o singură dată aici,
// altfel obligation() ar reciti toate plățile pentru fiecare copil (N×M).
/**
 * @param {RecordsSnapshot} records
 * @param {string} month
 * @param {string} [asOf]
 * @returns {ChildMonthEvaluation[]}
 */
export function evaluateChildrenForMonth(records, month, asOf = today()) {
  const index = paymentIndex(records.payments, asOf);
  return records.children.map(child => ({
    child,
    obligation: obligation(child, month, records.payments, asOf, index),
  }));
}
