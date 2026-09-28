import { cents } from '#shared/domain/money.mjs';
import { latestKnownRate, convertAmount } from '#shared/domain/exchange-rates.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Currency} Currency */
/** @typedef {import('#shared/domain/exchange-rates.mjs').ExchangeRates} ExchangeRates */
/** @typedef {import('./month-evaluation.mjs').ChildMonthEvaluation} ChildMonthEvaluation */
/** @typedef {import('./month-evaluation.mjs').ChildObligation} ChildObligation */
/** @typedef {import('./school-year-evaluation.mjs').ChildSchoolYearEvaluation} ChildSchoolYearEvaluation */
/** @typedef {'paid' | 'partial' | 'unpaid' | 'upcoming' | 'none'} HeatCellKind */

// Sumele pe mai mulți copii se arată în lei. Taxa unui copil în EUR intră cu
// cel mai recent curs cunoscut („≈ lei azi", regula 9 din 16-planuri-eur.md):
// cardurile de aici sunt datoria lunii, nu lei încasați efectiv (aceia sunt la
// Achitări/Dashboard).
// Fără niciun curs (filială nouă, offline), `null` — nu 1:1. Un 1:1 tăcut arăta
// 100 € ca 100 lei pe card, o eroare de ~20x care trece drept un număr normal
// (m22). Apelantul trebuie să semnaleze „fără curs”, nu să presupună un curs.
/**
 * @param {number} amount
 * @param {Currency} currency
 * @param {ExchangeRates} rates
 * @returns {number | null}
 */
export function toMdlToday(amount, currency, rates) {
  if (currency === 'MDL') return amount;
  return convertAmount(amount, currency, 'MDL', latestKnownRate(rates));
}

/**
 * @param {ChildMonthEvaluation[]} evaluations
 * @param {ExchangeRates} [rates]
 */
export function summarizeMonthStatus(evaluations, rates = {}) {
  let expectedCents = 0;
  let paidCents = 0;
  let overdueCents = 0;
  let owingChildren = 0;
  let overdueChildren = 0;
  // Un copil cu taxă EUR fără niciun curs cunoscut (m22): cardurile nu-l pot converti,
  // deci nu intră în sumele în lei; ecranul arată „fără curs” cât timp acest flag e activ.
  let hasMissingRate = false;
  for (const { obligation } of evaluations) {
    if (obligation.expected === null) continue;
    // tsc nu leagă tipul lui paid/rest de expected: obligation() le pune null împreună (același `unknown`), deci aici sunt garantat numere.
    const paid = obligation.paid ?? 0;
    const rest = obligation.rest ?? 0;
    if (obligation.expected > 0) owingChildren += 1;
    const expectedMdl = toMdlToday(obligation.expected, obligation.currency, rates);
    const paidMdl = toMdlToday(paid, obligation.currency, rates);
    if (expectedMdl === null || paidMdl === null) hasMissingRate = true;
    else {
      expectedCents += cents(expectedMdl);
      paidCents += cents(paidMdl);
    }
    if (obligation.label === 'Restanță') {
      overdueChildren += 1;
      const restMdl = toMdlToday(rest, obligation.currency, rates);
      if (restMdl === null) hasMissingRate = true;
      else overdueCents += cents(restMdl);
    }
  }
  return {
    expected: expectedCents / 100,
    paid: paidCents / 100,
    paidShare: expectedCents ? Math.min(1, paidCents / expectedCents) : 0,
    owingChildren,
    overdueChildren,
    overdue: overdueCents / 100,
    hasMissingRate,
  };
}

/**
 * @param {Pick<ChildObligation, 'expected' | 'paid' | 'rest' | 'due'>} obligation
 * @param {string} asOf
 * @returns {HeatCellKind}
 */
export function heatCellKind(obligation, asOf) {
  if (!obligation.expected) return 'none';
  if (obligation.rest === 0) return 'paid';
  if ((obligation.paid ?? 0) > 0) return 'partial';
  return asOf > obligation.due ? 'unpaid' : 'upcoming';
}

/**
 * @param {ChildSchoolYearEvaluation[]} yearEvaluations
 * @param {string} asOf
 * @param {string} referenceMonth luna „aceasta" pentru cardul plăților parțiale
 * @param {ExchangeRates} [rates]
 */
export function summarizeSchoolYear(yearEvaluations, asOf, referenceMonth, rates = {}) {
  let dueExpectedCents = 0;
  let duePaidCents = 0;
  let unrecoveredCents = 0;
  let overdueChildren = 0;
  let partialThisMonth = 0;
  // Vezi comentariul din summarizeMonthStatus (m22): o conversie fără curs nu intră în total.
  let hasMissingRate = false;

  const rows = yearEvaluations.map(({ child, months }) => {
    const cells = months.map(({ month, obligation }) => ({ month, kind: heatCellKind(obligation, asOf) }));
    const overdueMonths = months.filter(
      ({ obligation }) => obligation.expected !== null && (obligation.rest ?? 0) > 0 && asOf > obligation.due,
    );
    for (const { obligation } of months) {
      if (obligation.expected === null || obligation.due > asOf) continue;
      const expectedMdl = toMdlToday(obligation.expected, obligation.currency, rates);
      const paidMdl = toMdlToday(obligation.paid ?? 0, obligation.currency, rates);
      if (expectedMdl === null || paidMdl === null) {
        hasMissingRate = true;
        continue;
      }
      dueExpectedCents += cents(expectedMdl);
      duePaidCents += cents(paidMdl);
    }
    // Moneda taxei se poate schimba în cursul anului (feeHistory); doar atunci soldul se convertește.
    const currencies = new Set(overdueMonths.map(({ obligation }) => obligation.currency));
    const singleCurrency = currencies.size <= 1;
    const soldCents = overdueMonths.reduce((sum, { obligation }) => {
      const rest = obligation.rest ?? 0;
      if (singleCurrency) return sum + cents(rest);
      const restMdl = toMdlToday(rest, obligation.currency, rates);
      if (restMdl === null) {
        hasMissingRate = true;
        return sum;
      }
      return sum + cents(restMdl);
    }, 0);
    const sold = { amount: soldCents / 100, currency: singleCurrency ? ([...currencies][0] ?? 'MDL') : 'MDL' };
    const soldMdl = toMdlToday(sold.amount, sold.currency, rates);
    if (soldMdl === null) hasMissingRate = true;
    else unrecoveredCents += cents(soldMdl);
    if (sold.amount > 0) overdueChildren += 1;
    if (cells.find(cell => cell.month === referenceMonth)?.kind === 'partial') partialThisMonth += 1;
    return { child, cells, sold, hasObligation: cells.some(cell => cell.kind !== 'none') };
  });

  return {
    rows,
    overdueChildren,
    unrecovered: unrecoveredCents / 100,
    collectionRate: dueExpectedCents ? duePaidCents / dueExpectedCents : null,
    partialThisMonth,
    hasMissingRate,
  };
}
