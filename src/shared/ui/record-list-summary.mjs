import { cents } from '#shared/domain/money.mjs';
import { paymentTenders } from '#shared/domain/payment-allocations.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Payment} Payment */

// Totalul pe metodă al unei liste de achitări deja filtrate (arhivare, lună,
// copil, metodă, căutare) — folosit atât la sumarul listei „Achitări”, cât și
// la sumarul de cash al lunii (aceeași logică, calculată separat până acum).
/** @param {Payment[]} payments */
// Nu există „Altele”: o metodă necunoscută (posibil doar pe date vechi, B1) nu intră în
// niciun total — banii ei rămân doar în lista brută de plăți și în De rezolvat.
export function summarizePaymentsByMethod(payments) {
  const byMethod = { Cash: 0, Card: 0, Transfer: 0 };
  for (const payment of payments)
    for (const tender of paymentTenders(payment))
      if (Object.hasOwn(byMethod, tender.method)) byMethod[tender.method] += cents(tender.amount);
  for (const method of Object.keys(byMethod)) byMethod[method] /= 100;
  return byMethod;
}
