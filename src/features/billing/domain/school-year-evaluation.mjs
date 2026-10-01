import { today } from '#shared/domain/calendar-month.mjs';
import { paymentIndex } from '#shared/domain/payment-allocations.mjs';
import { obligation } from '#shared/domain/tuition-obligation.mjs';
import {
  SCHOOL_YEAR_START_MONTH,
  schoolYearStartOf,
  schoolYearMonths,
  schoolYearLabel,
} from '#shared/domain/school-year.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */
/** @typedef {import('#shared/domain/exchange-rates.mjs').ExchangeRates} ExchangeRates */
/** @typedef {import('./month-evaluation.mjs').ChildObligation} ChildObligation */
/** @typedef {{ child: Child, months: { month: string, obligation: ChildObligation }[] }} ChildSchoolYearEvaluation */

// Sursă unică mutată în `#shared/domain/school-year.mjs` (PROMPT-CLAUDE-CODE-7.md §2) — reexportate
// aici ca `index.web.mjs` și apelanții existenți (StatusPage, usePaymentReceipt) să rămână neschimbați.
export { SCHOOL_YEAR_START_MONTH, schoolYearStartOf, schoolYearMonths, schoolYearLabel };

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
      obligation: obligation(child, month, records.payments, records.charges, asOf, index, rates),
    })),
  }));
}
