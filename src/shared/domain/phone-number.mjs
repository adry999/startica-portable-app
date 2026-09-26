// Prefixele mobile acceptate de sms.md pentru destinația „moldova” (spec §4.2).
export const MOLDOVAN_MOBILE_PREFIXES = ['60', '61', '62', '67', '68', '69', '76', '78', '79', '80'];

/**
 * `+373XXXXXXXX` (E.164) sau null dacă textul nu e un număr mobil moldovenesc valid.
 * null înseamnă „fără telefon”: exclus din trimitere, marcat în dialog.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeMoldovanPhone(raw) {
  if (typeof raw !== 'string') return null;
  let digits = raw.replace(/[\s.\-()]/g, '');
  if (digits.startsWith('00')) digits = '+' + digits.slice(2);
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 11 && digits.startsWith('373')) digits = digits.slice(3);
  else if (digits.length === 9 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length !== 8 || !MOLDOVAN_MOBILE_PREFIXES.includes(digits.slice(0, 2))) return null;
  return '+373' + digits;
}
