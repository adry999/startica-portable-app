import { cents } from '#shared/domain/money.mjs';
import { allocations, paymentIndex } from '#shared/domain/payment-allocations.mjs';
import { obligation } from '#shared/domain/tuition-obligation.mjs';

/** @typedef {import('../payment-assignment.types.mjs').AssignmentRisk} AssignmentRisk */

// Câți copii ar putea fi raportați greșit ca restanțieri din cauza plăților
// nelegate. Un „de notificat” nu poate fi crezut cât timp cifra asta e mare.
/** @returns {AssignmentRisk} */
export function measureAssignmentRisk(records, month, asOf) {
  const unassigned = records.payments.filter(p => !p.archived && !p.childId);
  const covering = unassigned.filter(p => allocations(p).some(a => a.month === month));
  // Rulează la fiecare randare a aplicației — indexul evită O(copii×plăți).
  const index = paymentIndex(records.payments, asOf);
  const notified = records.children.filter(
    c => !c.archived && obligation(c, month, records.payments, asOf, index).notify,
  ).length;
  return {
    unassigned: unassigned.length,
    coveringMonth: covering.length,
    amountCoveringMonth: covering.reduce((sum, p) => sum + cents(p.amount), 0) / 100,
    notified,
  };
}
