import { fail } from '#core/server/errors/domain-error.mjs';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { parseKindergartenSettings } from '#shared/domain/kindergarten-settings.mjs';

/** @typedef {import('../receipts.types.d.mts').AssignReceiptNumberRequest} AssignReceiptNumberRequest */

const TRANSACTION_ACTION = 'numerotare-confirmare-plata';
const AUDIT_ACTION = 'numerotare confirmare de plată';
const PAYMENT_ID_OK = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * @param {{
 *   recordRepository: import('#shared/contracts/persistence.mjs').RecordRepository,
 *   auditTrail: import('#shared/contracts/audit-trail.mjs').AuditTrail,
 *   runRevisionTransaction: import('#shared/contracts/persistence.mjs').RunRevisionTransaction,
 *   readSetting: (key: string) => string,
 *   writeSetting: (key: string, value: string) => void,
 * }} dependencies
 */
export function createReceiptNumberingService({
  recordRepository,
  auditTrail,
  runRevisionTransaction,
  readSetting,
  writeSetting,
}) {
  /**
   * Numărul se asignează o singură dată, la prima tipărire, din
   * `kindergarten.nextReceiptNumber`, care crește la fel. O achitare deja
   * numerotată nu se schimbă la o reluare — retipărirea aceleiași achitări
   * refolosește numărul salvat, nu trage unul nou.
   * @param {AssignReceiptNumberRequest} request
   */
  function assignReceiptNumber(request) {
    const paymentId = request.paymentId;
    if (typeof paymentId !== 'string' || !PAYMENT_ID_OK.test(paymentId)) fail('Achitare invalidă.');

    const envelope = runRevisionTransaction(request, { action: TRANSACTION_ACTION }, () => {
      const payment = recordRepository.find('payments', paymentId);
      if (!payment) fail(`Achitarea ${paymentId} nu mai există. Reîncarcă datele.`, 409);
      if (payment.receiptNumber) return; // are deja un număr — nu se reasignează.

      const settings = parseKindergartenSettings(readSetting('kindergarten'));
      const updated = normalizeRecord('payments', { ...payment, receiptNumber: settings.nextReceiptNumber });
      recordRepository.save('payments', updated);
      writeSetting('kindergarten', JSON.stringify({ ...settings, nextReceiptNumber: settings.nextReceiptNumber + 1 }));
      auditTrail.recordChange({
        action: AUDIT_ACTION,
        recordType: 'payments',
        recordId: payment.id,
        before: payment,
        after: updated,
      });
    });

    // Re-citit după tranzacție: la fel de corect fie că numărul s-a asignat
    // chiar acum, fie că achitarea îl avea deja (reluare sau retipărire).
    const payment = recordRepository.find('payments', paymentId);
    return { ...envelope, receiptNumber: payment?.receiptNumber ?? null };
  }

  return { assignReceiptNumber };
}
