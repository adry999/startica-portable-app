import { obligation, feeEntryFor, nextMonth } from './tuition-obligation.mjs';
import { cents } from './money.mjs';

// Peste durata obișnuită de frecventare a unei grădinițe — gardă împotriva unei sume absurd de
// mari care ar roti la nesfârșit (plafonăm, nu blocăm: restul rămâne pe ultima lună atinsă).
const MAX_MONTHS_ROLLED = 120;

/**
 * F7 (FEEDBACK-01-10.md): o achitare acoperă întâi (opțional) restanțele bifate explicit, apoi
 * luna plății, iar surplusul trece pe lunile următoare (avans) — niciodată automat pe restanțe
 * nebifate. Funcție pură: nu citește/scrie nimic, doar calculează rândurile de repartizare.
 *
 * @param {object} params
 * @param {import('#shared/contracts/record-types.mjs').Child} params.child
 * @param {import('#shared/contracts/record-types.mjs').Payment[]} params.payments
 * @param {import('#shared/contracts/record-types.mjs').Charge[]} [params.charges]
 * @param {import('./exchange-rates.mjs').ExchangeRates} [params.rates]
 * @param {string} params.asOf — data plății (obligation() o folosește ca să nu numere plăți viitoare).
 * @param {string} params.paymentMonth — luna plății ("AAAA-LL"), punctul de pornire după restanțe.
 * @param {number} params.amount — suma totală de repartizat, în moneda taxei copilului.
 * @param {Array<string>=} params.arrearMonths — restanțele bifate explicit de utilizator, în ordine cronologică (opțional, implicit niciuna).
 * @returns {{ month: string, amount: number }[]}
 */
export function autoAllocatePayment({
  child,
  payments,
  charges = [],
  rates = {},
  asOf,
  paymentMonth,
  amount,
  arrearMonths = [],
}) {
  const rows = [];
  let remainingCents = cents(amount);
  if (remainingCents <= 0) return rows;

  const queue = [...arrearMonths, paymentMonth];
  let month = queue[0];
  let queueIndex = 1;

  for (let i = 0; i < MAX_MONTHS_ROLLED && remainingCents > 0; i += 1) {
    const currentMonth = month;
    month = queueIndex < queue.length ? queue[queueIndex] : nextMonth(currentMonth);
    queueIndex += 1;

    const result = obligation(child, currentMonth, payments, charges, asOf, null, rates);
    const owed = result.rest ?? feeEntryFor(child, currentMonth)?.amount ?? null;
    // Obligație necunoscută (fără taxă setată pentru lună) — nu mai putem decide cât îi revine
    // acestei luni; restul rămâne nerepartizat pe ea (vezi fallback-ul de mai jos).
    if (owed === null) break;

    const owedCents = cents(Math.max(0, owed));
    if (owedCents === 0) continue; // deja achitată — trecem mai departe, fără rând gol.

    const take = Math.min(remainingCents, owedCents);
    rows.push({ month: currentMonth, amount: take / 100 });
    remainingCents -= take;
  }

  if (remainingCents > 0) {
    if (rows.length > 0) {
      rows[rows.length - 1].amount = Math.round(rows[rows.length - 1].amount * 100 + remainingCents) / 100;
    } else {
      rows.push({ month: paymentMonth, amount: remainingCents / 100 });
    }
  }

  return rows;
}
