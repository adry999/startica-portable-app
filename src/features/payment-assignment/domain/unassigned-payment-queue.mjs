import { paymentIndex } from '#shared/domain/payment-allocations.mjs';
import { suggestChildren } from './payment-name-matching.mjs';

/** @typedef {import('../payment-assignment.types.mjs').AssignmentQueueEntry} AssignmentQueueEntry */

// Achitările fără copil, cu sugestiile lor. Cele mai recente primele: sunt cele
// care afectează situația curentă.
/** @returns {AssignmentQueueEntry[]} */
export function listUnassignedPayments(records, limit = 200) {
  const open = records.payments
    .filter(p => !p.archived && !p.childId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
  const index = paymentIndex(records.payments);
  return open.map(payment => ({ payment, suggestions: suggestChildren(payment, records.children, index) }));
}
