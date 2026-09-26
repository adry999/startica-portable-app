import { formatMoney } from '#shared/format/money-format.mjs';
import { formatDate, formatMonthName } from '#shared/format/date-format.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */
/** @typedef {{ expected: number | null, paid: number | null, rest: number | null, due: string }} SmsObligation */

export const SMS_TEMPLATE_VARIABLES = Object.freeze(['părinte', 'copil', 'luna', 'taxa', 'rest', 'achitat', 'zi']);
export const SMS_TEMPLATE_MAX_LENGTH = 800;

// Textul fix de dinainte de șabloane, rescris cu variabile; e și seed-ul din sms_templates.
export const DEFAULT_SMS_TEMPLATE_BODY =
  'Bună ziua, {părinte}! Vă reamintim că taxa pentru {luna} pentru {copil} este de {taxa}, cu scadența la {zi}. ' +
  'Rest de plată: {rest}. Vă mulțumim! Startica';

/**
 * Înlocuiește variabilele; cele necunoscute rămân ca atare (vizibile în previzualizare, nu ascunse).
 * @param {string} body
 * @param {Record<string, string>} variables
 */
export function renderSmsTemplate(body, variables) {
  return body
    .replace(/, \{părinte\}/g, variables['părinte'] ? `, ${variables['părinte']}` : '')
    .replace(/\{([^{}]+)\}/g, (match, name) => (Object.hasOwn(variables, name) ? variables[name] : match));
}

/**
 * @param {{ child: Child, parentName: string, obligation: SmsObligation, month: string }} params
 * @returns {Record<string, string>}
 */
export function smsVariablesFor({ child, parentName, obligation, month }) {
  return {
    părinte: parentName,
    copil: child.name,
    luna: formatMonthName(month),
    taxa: formatMoney(obligation.expected),
    rest: formatMoney(obligation.rest),
    achitat: formatMoney(obligation.paid),
    zi: formatDate(obligation.due),
  };
}

/** @param {string} body */
export function findUnknownSmsVariables(body) {
  return [...body.matchAll(/\{([^{}]+)\}/g)]
    .map(match => match[1])
    .filter(name => !SMS_TEMPLATE_VARIABLES.includes(name));
}
