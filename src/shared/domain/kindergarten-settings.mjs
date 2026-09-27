// Datele grădiniței (16a din docs/design/screens/12-administrare.md), folosite
// pe antetul documentelor tipărite (confirmarea de plată, situația plăților).
// Un singur obiect, în settings, ca notificationPreferences — implicitele nu
// blochează nimic dacă operatorul nu a completat încă fila „Grădinița”.

/** @typedef {'a5' | 'a4-third'} ReceiptFormat */

/**
 * @typedef {{
 *   name: string,
 *   displayName: string,
 *   idno: string,
 *   administrator: string,
 *   address: string,
 *   phone: string,
 *   email: string,
 *   website: string,
 *   iban: string,
 *   bank: string,
 *   nextReceiptNumber: number,
 *   receiptFormat: ReceiptFormat,
 *   signatureLabel: string,
 *   footerNote: string,
 *   logoDataUrl: string,
 * }} KindergartenSettings
 */

/** @type {KindergartenSettings} */
export const DEFAULT_KINDERGARTEN_SETTINGS = {
  name: '',
  displayName: '',
  idno: '',
  administrator: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  iban: '',
  bank: '',
  nextReceiptNumber: 1,
  receiptFormat: 'a5',
  signatureLabel: '',
  footerNote: '',
  logoDataUrl: '',
};

const RECEIPT_FORMATS = ['a5', 'a4-third'];
const MAX_TEXT_LENGTH = 300;
// Logo mic, ca settings (coloană TEXT în SQLite) să nu ajungă un blob de câțiva MB.
const MAX_LOGO_LENGTH = 300000;

const asText = (value, fallback, maxLength = MAX_TEXT_LENGTH) =>
  typeof value === 'string' && value.length <= maxLength ? value.trim() : fallback;

/**
 * Completează și validează un obiect parțial (din formular sau dintr-un JSON
 * eventual corupt) cu implicitele pentru orice câmp lipsă sau nevalid — nu
 * aruncă niciodată, la fel ca clampNotificationPreferences.
 * @param {Partial<KindergartenSettings> | null | undefined} overrides
 * @returns {KindergartenSettings}
 */
export function clampKindergartenSettings(overrides) {
  const input = overrides && typeof overrides === 'object' ? overrides : {};
  const d = DEFAULT_KINDERGARTEN_SETTINGS;
  const nextReceiptNumber = Math.round(Number(input.nextReceiptNumber));
  return {
    name: asText(input.name, d.name),
    displayName: asText(input.displayName, d.displayName),
    idno: asText(input.idno, d.idno),
    administrator: asText(input.administrator, d.administrator),
    address: asText(input.address, d.address),
    phone: asText(input.phone, d.phone),
    email: asText(input.email, d.email),
    website: asText(input.website, d.website),
    iban: asText(input.iban, d.iban),
    bank: asText(input.bank, d.bank),
    nextReceiptNumber:
      Number.isFinite(nextReceiptNumber) && nextReceiptNumber >= 1 ? nextReceiptNumber : d.nextReceiptNumber,
    receiptFormat: RECEIPT_FORMATS.includes(/** @type {string} */ (input.receiptFormat))
      ? /** @type {ReceiptFormat} */ (input.receiptFormat)
      : d.receiptFormat,
    signatureLabel: asText(input.signatureLabel, d.signatureLabel),
    footerNote: asText(input.footerNote, d.footerNote, 500),
    logoDataUrl: asText(input.logoDataUrl, d.logoDataUrl, MAX_LOGO_LENGTH),
  };
}

/**
 * @param {string | undefined | null} json
 * @returns {KindergartenSettings}
 */
export function parseKindergartenSettings(json) {
  if (!json) return clampKindergartenSettings(null);
  try {
    return clampKindergartenSettings(JSON.parse(json));
  } catch {
    return clampKindergartenSettings(null);
  }
}
