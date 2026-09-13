import { fail } from '#core/server/errors/domain-error.mjs';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';

/** @typedef {import('../payment-assignment.types.mjs').AssignPaymentsRequest} AssignPaymentsRequest */
/** @typedef {import('../payment-assignment.types.mjs').PaymentAssignmentServiceDependencies} PaymentAssignmentServiceDependencies */

const MAX_ASSIGNMENTS_PER_REQUEST = 5000;
const TRANSACTION_ACTION = 'asociere-achitari';
const AUDIT_ACTION = 'asociere achitare';

/** @param {unknown} input */
function parseAssignments(input) {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_ASSIGNMENTS_PER_REQUEST)
    fail('Lista de asocieri este invalidă.');
  const seenPaymentIds = new Set();
  return input.map(assignment => {
    const paymentId = assignment?.id;
    const childId = assignment?.childId;
    if (typeof paymentId !== 'string' || typeof childId !== 'string' || !childId)
      fail('Fiecare asociere are nevoie de o achitare și de un copil.');
    if (seenPaymentIds.has(paymentId)) fail(`Achitarea ${paymentId} apare de două ori.`);
    seenPaymentIds.add(paymentId);
    return { paymentId, childId };
  });
}

/** @param {PaymentAssignmentServiceDependencies} dependencies */
export function createPaymentAssignmentService({ recordRepository, auditTrail, runRevisionTransaction }) {
  // Doar achitările fără copil se leagă aici: o asociere existentă nu se schimbă printr-o operațiune în masă.
  function assignPayment({ paymentId, childId }) {
    const payment = recordRepository.find('payments', paymentId);
    if (!payment) fail(`Achitarea ${paymentId} nu mai există. Reîncarcă datele.`, 409);
    if (payment.childId) fail(`Achitarea ${paymentId} are deja un copil asociat.`, 409);
    if (!recordRepository.exists('children', childId)) fail(`Copilul ${childId} nu există.`);

    const assignedPayment = normalizeRecord('payments', { ...payment, childId });
    recordRepository.save('payments', assignedPayment);
    auditTrail.recordChange({
      action: AUDIT_ACTION,
      recordType: 'payments',
      recordId: paymentId,
      before: payment,
      after: assignedPayment,
    });
  }

  /**
   * Verificările pe fiecare achitare rulează în tranzacție, după controlul de reluare: o cerere
   * repetată după o cădere de rețea primește rezultatul inițial, nu eroarea „are deja un copil”.
   * @param {AssignPaymentsRequest} request
   */
  function assignPaymentsToChildren(request) {
    const assignments = parseAssignments(request.assignments);
    return runRevisionTransaction(request, { action: TRANSACTION_ACTION, backupBefore: true }, () => {
      for (const assignment of assignments) assignPayment(assignment);
    });
  }

  return { assignPaymentsToChildren };
}
