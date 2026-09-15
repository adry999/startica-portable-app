import { escapeHtml } from './html-escape.mjs';
import { formatMoney } from './money-format.mjs';
import { paymentTenders } from '#shared/domain/payment-allocations.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Payment} Payment */

/** @param {Payment} payment */
export function formatPaymentTenders(payment) {
  return paymentTenders(payment)
    .map(part => `<span class="money-line">${escapeHtml(part.method)}: ${formatMoney(part.amount)}</span>`)
    .join('<br>');
}
