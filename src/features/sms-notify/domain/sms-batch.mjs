import { normalizeMoldovanPhone } from '#shared/domain/phone-number.mjs';
import { renderSmsTemplate, smsVariablesFor } from '#shared/domain/sms-template.mjs';
import { countSmsSegments } from '#shared/domain/sms-segments.mjs';
import { stripDiacritics } from '#shared/format/strip-diacritics.mjs';

/** @typedef {import('../sms-notify.types.mjs').SmsRecipientRow} SmsRecipientRow */
/** @typedef {import('../sms-notify.types.mjs').SmsBatchPlan} SmsBatchPlan */

export const NO_VALID_PHONE_REASON = 'Fără telefon valid';

// Părintele 1, cu cădere pe părintele 2 — un singur SMS per copil (RASPUNSURI 5).
/** @param {import('#shared/contracts/record-types.mjs').Child} child */
export function chooseSmsRecipient(child) {
  const candidates = [
    [child.parent, child.phone],
    [child.parent2 || '', child.phone2 || ''],
  ];
  for (const [name, rawPhone] of candidates) {
    const phone = normalizeMoldovanPhone(rawPhone);
    if (phone) return { parentLabel: name, phone };
  }
  return null;
}

// Fără diacritice se aplică ÎNAINTE de numărare: contorul arată exact ce se plătește (spec §3.4).
/** @param {string} text @param {boolean} stripDiacriticsEnabled */
export function finalizeSmsText(text, stripDiacriticsEnabled) {
  const finalText = stripDiacriticsEnabled ? stripDiacritics(text) : text;
  return { text: finalText, ...countSmsSegments(finalText) };
}

/** @param {number} totalSegments @param {number} unitCost */
export const estimateSmsCost = (totalSegments, unitCost) => Math.round(totalSegments * unitCost * 100) / 100;

/**
 * @param {{ rows: SmsRecipientRow[], body: string, stripDiacritics: boolean, month: string }} input
 * @returns {SmsBatchPlan}
 */
export function planSmsBatch({ rows, body, stripDiacritics: stripDiacriticsEnabled, month }) {
  const messages = [];
  const excluded = [];
  for (const { child, obligation } of rows) {
    const recipient = chooseSmsRecipient(child);
    if (!recipient) {
      excluded.push({ childId: child.id, childName: child.name, reason: NO_VALID_PHONE_REASON });
      continue;
    }
    const rendered = renderSmsTemplate(
      body,
      smsVariablesFor({ child, parentName: recipient.parentLabel, obligation, month }),
    );
    messages.push({
      childId: child.id,
      childName: child.name,
      recipientName: recipient.parentLabel,
      parentLabel: recipient.parentLabel,
      phone: recipient.phone,
      ...finalizeSmsText(rendered, stripDiacriticsEnabled),
    });
  }
  return { messages, excluded, totalSegments: messages.reduce((sum, message) => sum + message.segments, 0) };
}
