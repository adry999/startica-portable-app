import { cents, total } from '#shared/domain/money.mjs';
import { allocations, paymentTenders } from '#shared/domain/payment-allocations.mjs';
import { eurToMdlRate, convertAmount } from '#shared/domain/exchange-rates.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').Payment} Payment */
/** @typedef {import('#shared/domain/exchange-rates.mjs').ExchangeRates} ExchangeRates */

// O plată deja încasată e un fapt istoric: convertită cu cursul zilei EI, nu al
// azi. Fără niciun curs cunoscut vreodată pentru acea zi, suma nu se convertește
// (rămâne 1:1) — un total de dashboard trebuie să arate mereu un număr, nu poate
// cădea pe „De verificat” ca fișa unui singur copil.
/**
 * @param {number} amount
 * @param {import('#shared/contracts/record-types.mjs').Currency} currency
 * @param {string} date
 * @param {ExchangeRates} rates
 */
function toMdl(amount, currency, date, rates) {
  if (currency === 'MDL') return amount;
  const converted = convertAmount(amount, currency, 'MDL', eurToMdlRate(rates, date));
  return converted ?? amount;
}

/**
 * @param {RecordsSnapshot} records
 * @param {string} month
 * @param {ExchangeRates} [rates]
 */
export function summarizeCashForMonth(records, month, rates = {}) {
  const payments = records.payments.filter(p => !p.archived && p.date.startsWith(month));
  const income =
    total(
      payments.map(p => ({ amount: toMdl(p.amount, /** @type {any} */ (p).currency || 'MDL', p.date, rates) })),
    );
  const byMethod = { Cash: 0, Card: 0, Transfer: 0, Altele: 0 };
  for (const p of payments) {
    const paymentCurrency = /** @type {any} */ (p).currency || 'MDL';
    for (const part of paymentTenders(p)) {
      const method = Object.hasOwn(byMethod, part.method) ? part.method : 'Altele';
      byMethod[method] += cents(toMdl(part.amount, paymentCurrency, p.date, rates));
    }
  }
  for (const method of Object.keys(byMethod)) byMethod[method] /= 100;
  const expense = total(records.expenses.filter(p => !p.archived && p.date.startsWith(month)));
  return { income, expense, net: (cents(income) - cents(expense)) / 100, byMethod };
}

// Avans = partea dintr-o plată încasată, dar nerepartizată pe nicio lună.
/**
 * @param {Payment[]} payments
 * @param {string} asOf
 * @param {ExchangeRates} [rates]
 */
export function sumUnallocatedAdvance(payments, asOf, rates = {}) {
  return (
    payments
      // Fără copil asociat, plata nu e a nimănui — nu e un avans de scăzut din obligația cuiva.
      .filter(p => !p.archived && p.childId && p.date <= asOf)
      .reduce((sum, p) => {
        const currency = /** @type {any} */ (p).currency || 'MDL';
        const unallocated = cents(p.amount) - allocations(p).reduce((n, a) => n + cents(a.amount), 0);
        return sum + cents(toMdl(unallocated / 100, currency, p.date, rates));
      }, 0) / 100
  );
}
