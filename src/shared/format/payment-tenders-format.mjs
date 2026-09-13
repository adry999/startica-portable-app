import { escapeHtml } from './html-escape.mjs';
import { formatMoney } from './money-format.mjs';
import { paymentTenders } from '#shared/domain/payment-allocations.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Payment} Payment */

/** @param {Payment} payment */
export function formatPaymentTenders(payment) {
  return paymentTenders(payment)
    .map(part => `${escapeHtml(part.method)}: ${formatMoney(part.amount)}`)
    .join('<br>');
}
