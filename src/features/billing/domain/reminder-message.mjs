import { formatMoney } from '#shared/format/money-format.mjs';
import { formatDate, formatMonthLabel } from '#shared/format/date-format.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */
/** @typedef {{ expected: number | null, rest: number | null, due: string }} ReminderObligation */

/**
 * Mesajul de reamintire pentru „De notificat”, șablon fix decis de produs (fără setări).
 * @param {{ child: Child, obligation: ReminderObligation, month: string }} params
 * @returns {string}
 */
export function reminderMessage({ child, obligation, month }) {
  return (
    `Bună ziua${child.parent ? `, ${child.parent}` : ''}! Vă reamintim că taxa pentru ${formatMonthLabel(month)} ` +
    `pentru ${child.name} este de ${formatMoney(obligation.expected)}, cu scadența la ${formatDate(obligation.due)}. ` +
    `Rest de plată: ${formatMoney(obligation.rest)}. Vă mulțumim! Startica`
  );
}
