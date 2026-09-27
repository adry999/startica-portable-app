import { today } from '#shared/domain/calendar-month.mjs';
import { paymentIndex } from '#shared/domain/payment-allocations.mjs';
import { obligation } from '#shared/domain/tuition-obligation.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */
/** @typedef {import('#shared/domain/exchange-rates.mjs').ExchangeRates} ExchangeRates */
/** @typedef {import('./month-evaluation.mjs').ChildObligation} ChildObligation */
/** @typedef {{ child: Child, months: { month: string, obligation: ChildObligation }[] }} ChildSchoolYearEvaluation */

// Anul școlar începe în septembrie (Backup și setări → Grădinița, „An școlar: începe în septembrie").
export const SCHOOL_YEAR_START_MONTH = 9;

/** @param {string} monthKey YYYY-MM */
export function schoolYearStartOf(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return month >= SCHOOL_YEAR_START_MONTH ? year : year - 1;
}

/** @param {number} startYear */
export function schoolYearMonths(startYear) {
  return Array.from({ length: 12 }, (_, index) => {
    const offset = SCHOOL_YEAR_START_MONTH - 1 + index;
    return `${startYear + Math.floor(offset / 12)}-${String((offset % 12) + 1).padStart(2, '0')}`;
  });
}

/** @param {number} startYear */
export const schoolYearLabel = startYear => `Anul școlar ${startYear}–${startYear + 1}`;

// Harta anului școlar are nevoie de fiecare copil pe fiecare din cele 12 luni.
// Indexul de încasări se construiește o singură dată aici — 12 apeluri de
// evaluateChildrenForMonth l-ar reconstrui de 12 ori.
/**
 * @param {RecordsSnapshot} records
 * @param {number} startYear
 * @param {string} [asOf]
 * @param {ExchangeRates} [rates]
 * @returns {ChildSchoolYearEvaluation[]}
 */
export function evaluateChildrenForSchoolYear(records, startYear, asOf = today(), rates = {}) {
  const months = schoolYearMonths(startYear);
  const index = paymentIndex(records.payments, asOf);
  return records.children.map(child => ({
    child,
    months: months.map(month => ({
      month,
      obligation: obligation(child, month, records.payments, asOf, index, rates),
    })),
  }));
}
