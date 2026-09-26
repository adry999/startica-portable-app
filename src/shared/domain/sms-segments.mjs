// Setul de bază GSM 03.38 (fără ESC) și extensia lui; orice alt caracter — chirilice,
// ă â î ș ț, emoji — comută tot mesajul pe UCS-2 (regulile din documentația sms.md, §Billing).
const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM7_EXTENDED = '\f^{}\\[~]|€';

const GSM7_SINGLE = 160;
const GSM7_MULTI = 153;
const UCS2_SINGLE = 70;
const UCS2_MULTI = 67;

/** @typedef {{ characters: number, segments: number, encoding: 'gsm-7' | 'ucs-2' }} SmsSegmentCount */

/**
 * @param {string} text
 * @returns {SmsSegmentCount}
 */
export function countSmsSegments(text) {
  if (!text) return { characters: 0, segments: 0, encoding: 'gsm-7' };
  let septets = 0;
  for (const character of text) {
    if (GSM7_BASIC.includes(character)) septets += 1;
    else if (GSM7_EXTENDED.includes(character)) septets += 2;
    else {
      const units = text.length;
      return {
        characters: units,
        segments: units <= UCS2_SINGLE ? 1 : Math.ceil(units / UCS2_MULTI),
        encoding: 'ucs-2',
      };
    }
  }
  return {
    characters: septets,
    segments: septets <= GSM7_SINGLE ? 1 : Math.ceil(septets / GSM7_MULTI),
    encoding: 'gsm-7',
  };
}
