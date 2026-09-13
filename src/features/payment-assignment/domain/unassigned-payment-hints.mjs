import { paymentIndex } from '#shared/domain/payment-allocations.mjs';
import { suggestChildren } from './payment-name-matching.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Payment} Payment */

// Harta copil → achitările neasociate care îl sugerează. Doar potrivirea de
// nume leagă o plată de un anume copil (vezi suggestChildren), deci un
// candidat fără nameMatch nu apare aici — ar da un fals sentiment de rezolvare.
/** @returns {Map<string, Payment[]>} */
export function findUnassignedPaymentHintsByChild(records) {
  const index = paymentIndex(records.payments);
  const byChild = new Map();
  for (const payment of records.payments.filter(p => !p.archived && !p.childId)) {
    for (const s of suggestChildren(payment, records.children, index)) {
      if (!s.nameMatch) continue;
      let list = byChild.get(s.id);
      if (!list) byChild.set(s.id, (list = []));
      list.push(payment);
    }
  }
  return byChild;
}
