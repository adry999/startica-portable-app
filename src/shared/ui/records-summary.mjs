import { formatMoney } from '#shared/format/money-format.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {{ children: number, payments: number, expenses: number, paymentTotal: number, expenseTotal: number }} RecordsSummary */

/** @param {RecordsSummary} summary */
export const recordsSummaryMarkup = summary =>
  `<p>${summary.children} copii · ${summary.payments} achitări · ${summary.expenses} cheltuieli</p>` +
  `<p>Total achitări: ${formatMoney(summary.paymentTotal)} · Total cheltuieli: ${formatMoney(summary.expenseTotal)}</p>`;
