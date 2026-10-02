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

/**
 * Ce se salvează pentru un telefon introdus liber (decizia 02.10, §10 — un singur format
 * salvat): un mobil moldovenesc valid devine E.164; un text cu prefix „+" care nu e moldovenesc
 * e „alt număr" și se salvează exact cum a fost scris; orice altceva rămâne cum a fost scris,
 * dar marcat `invalid` — vezi `phoneInvalid`/`phone2Invalid` din record-schema.mjs/personal-schema.mjs,
 * pentru bannerul „de verificat" (§9.3/§14, nu construit aici).
 * @param {unknown} raw
 * @returns {{ value: string, invalid: boolean }}
 */
export function resolveStoredPhone(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return { value: '', invalid: false };
  const normalized = normalizeMoldovanPhone(trimmed);
  if (normalized) return { value: normalized, invalid: false };
  if (trimmed.startsWith('+')) return { value: trimmed, invalid: false };
  return { value: trimmed, invalid: true };
}

// Sub acest prag, orice șir numeric ar deveni „fragment de telefon" — prea zgomotos pentru o căutare.
const MIN_PHONE_FRAGMENT_DIGITS = 3;

// Cifrele unui telefon, fără +/spații/liniuțe/paranteze/punct — „00" inițial tratat ca „+", ca
// potrivirea pe sufix să funcționeze indiferent de cum a fost scris prefixul de țară.
/**
 * @param {unknown} raw
 * @returns {string}
 */
export function phoneDigitsOf(raw) {
  if (!raw) return '';
  let digits = String(raw).replace(/[\s.\-()]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('+')) digits = digits.slice(1);
  return digits;
}

/**
 * Un query „de telefon" e fie un mobil moldovenesc complet (orice formă de scriere —
 * `normalizeMoldovanPhone` îl aduce la E.164), fie un fragment numeric de minim
 * {@link MIN_PHONE_FRAGMENT_DIGITS} cifre — ex. „1234" găsește un telefon terminat în …1234,
 * indiferent de prefixul de țară. Altfel, `null` (nu e o căutare de telefon).
 * @param {string} query
 * @returns {string | null}
 */
export function phoneQueryDigits(query) {
  const normalized = normalizeMoldovanPhone(query);
  if (normalized) return normalized.slice(1); // fără „+"
  const digits = phoneDigitsOf(query);
  return digits.length >= MIN_PHONE_FRAGMENT_DIGITS && /^\d+$/.test(digits) ? digits : null;
}

/**
 * @param {unknown} phone
 * @param {string} queryDigits
 * @returns {boolean}
 */
export function matchesPhoneSuffix(phone, queryDigits) {
  const digits = phoneDigitsOf(phone);
  return digits.length > 0 && digits.endsWith(queryDigits);
}

/** Telefonul 1/2 al unei fișe (copil sau angajat) plus persoanele autorizate, dacă există.
 * @param {{ phone?: unknown, phone2?: unknown, pickupPersons?: { phone?: unknown }[] }} record
 * @param {string} queryDigits
 * @returns {boolean}
 */
export function matchesPhoneSuffixAny(record, queryDigits) {
  if (matchesPhoneSuffix(record.phone, queryDigits)) return true;
  if (matchesPhoneSuffix(record.phone2, queryDigits)) return true;
  return (record.pickupPersons ?? []).some(person => matchesPhoneSuffix(person.phone, queryDigits));
}
