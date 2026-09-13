import { cents } from '#shared/domain/money.mjs';
import { allocations } from '#shared/domain/payment-allocations.mjs';
import { STATUS_HISTORY_VALUES } from '#shared/domain/record-schema.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */
/** @typedef {import('#shared/contracts/record-types.mjs').Payment} Payment */
/** @typedef {import('../review-center.types.mjs').RecordIssue} RecordIssue */

/**
 * @param {{ children: Child[], payments: Payment[] }} records
 * @returns {RecordIssue[]}
 */
export function findRecordIssues(records) {
  const result = [];
  const add = (type, record, reason) =>
    result.push({
      type,
      id: record.id,
      name: record.name || record.childName || record.sourceName || record.description || record.id,
      reason,
    });
  for (const child of records.children.filter(record => !record.archived)) {
    if (!child.feeHistory?.length)
      add('children', child, child.fee == null ? 'Taxă lipsă' : 'Taxă fără lună de aplicare');
    if (!child.groupId) add('children', child, 'Grupă lipsă');
    if (!child.attendanceDate) add('children', child, 'Data începerii frecventării lipsește');
    if (!STATUS_HISTORY_VALUES.includes(child.status)) add('children', child, 'Statut de verificat');
    if (
      child.parent &&
      child.name &&
      child.parent.trim().toLocaleLowerCase('ro-RO') === child.name.trim().toLocaleLowerCase('ro-RO')
    )
      add('children', child, 'Părintele are același nume ca copilul; verifică sursa');
    if (
      child.birthDate &&
      ((child.contractDate && child.birthDate > child.contractDate) ||
        (child.attendanceDate && child.birthDate > child.attendanceDate))
    )
      add('children', child, 'Data nașterii este după contract / începutul frecventării');
  }
  const fingerprints = new Map();
  for (const payment of records.payments.filter(record => !record.archived)) {
    if (!payment.childId) add('payments', payment, 'Copil neasociat');
    if (allocations(payment).reduce((sum, allocation) => sum + cents(allocation.amount), 0) < cents(payment.amount))
      add('payments', payment, 'Avans nerepartizat');
    if (payment.verification && !/^OK$/i.test(payment.verification.trim()) && !payment.reviewed)
      add('payments', payment, `Verificare import: ${payment.verification}`);
    const fingerprint = JSON.stringify([
      payment.childId || payment.sourceName || payment.childName,
      payment.date,
      cents(payment.amount),
      payment.method,
    ]);
    if (fingerprints.has(fingerprint)) add('payments', payment, `Posibil duplicat cu ${fingerprints.get(fingerprint)}`);
    else fingerprints.set(fingerprint, payment.id);
  }
  return result;
}
