import { today, shiftDays, daysBetween } from './calendar-month.mjs';
import { cents } from './money.mjs';
import { allocations, allocationCurrency } from './payment-allocations.mjs';
import { eurToMdlRate, convertAmount } from './exchange-rates.mjs';
import { DEFAULT_SERVICE_ID, POOL_SERVICE_ID } from './record-schema.mjs';

// Cu câte zile înainte de scadență trece eticheta pe „Scadent în curând”.
const NOTICE_DAYS = 3;
// Scadența lunară este ziua din data contractului. dueDay rămâne ca rezervă
// pentru fișele fără contract completat.
export function dueDayFor(child) {
  const fromContract = Number(child.contractDate?.slice(8, 10));
  return fromContract >= 1 && fromContract <= 31 ? fromContract : child.dueDay || 10;
}
// Sumează o listă de intrări (din paymentIndex, sau construită direct din
// `payments` când nu există index) în moneda taxei, convertind fiecare la
// cursul zilei EI, nu la un curs unic pentru toată suma — altfel două plăți
// din zile cu curs diferit s-ar aduna greșit.
/**
 * @param {{ amount: number, currency: import('#shared/contracts/record-types.mjs').Currency, date: string }[]} entries
 * @param {import('#shared/contracts/record-types.mjs').Currency} targetCurrency
 * @param {import('./exchange-rates.mjs').ExchangeRates} rates
 * @returns {number | null}
 */
function sumEntriesInCurrency(entries, targetCurrency, rates) {
  let sumCents = 0;
  for (const entry of entries) {
    const converted =
      entry.currency === targetCurrency
        ? entry.amount
        : convertAmount(entry.amount, entry.currency, targetCurrency, eurToMdlRate(rates, entry.date));
    if (converted === null) return null;
    sumCents += cents(converted);
  }
  return sumCents / 100;
}
// Intrarea de taxă aplicabilă la o lună dată — ultima cu from <= month, sau
// null dacă nu există niciuna. Exportată separat de obligation() pentru că
// webapp are nevoie doar de monedă/sumă (fără calcul de obligație) când
// decide dacă arată formularul de achitare cu conversie EUR (punctul 8).
/** @returns {{ from: string, amount: number, currency?: import('#shared/contracts/record-types.mjs').Currency } | null} */
export function feeEntryFor(child, month) {
  const fees = [...(child.feeHistory || [])].sort((a, b) => a.from.localeCompare(b.from));
  return fees.filter(f => f.from <= month).at(-1) ?? null;
}
// `index` este opțional: dacă lipsește, se calculează pe loc, ca apelurile
// izolate (un singur copil, o singură lună) să rămână simple.
// `charges` (decizia 4, 2026-09-27-personal-bazin.md) e lista completă a taxelor suplimentare
// (ex. Bazin) — parametru obligatoriu, înaintea lui asOf, ca niciun apelant să nu-l uite în
// tăcere (o valoare lipsă ar arăta sume greșite fără nicio eroare).
/** @param {Map<string, Map<string, {amount: number, currency: import('#shared/contracts/record-types.mjs').Currency, date: string}[]>> | null} [index] */
export function obligation(child, month, payments, charges, asOf = today(), index = null, rates = {}) {
  const start = child.attendanceDate?.slice(0, 7),
    end = child.withdrawalDate?.slice(0, 7);
  const history = [...(child.statusHistory || [])]
    .sort((a, b) => a.from.localeCompare(b.from))
    .filter(r => r.from <= month);
  const status = history.at(-1)?.status || (!child.statusHistory?.length && child.status === 'Activ' ? 'Activ' : null);
  const inactive = (start && month < start) || (end && month > end) || status === 'Suspendat' || status === 'Retras';
  const feeEntry = feeEntryFor(child, month);
  const fee = feeEntry?.amount ?? null;
  const feeCurrency = feeEntry?.currency ?? 'MDL';
  const paidEntries = index
    ? (index.get(child.id)?.get(month) ?? [])
    : payments
        .filter(p => !p.archived && p.childId === child.id && p.date <= asOf)
        .flatMap(p =>
          allocations(p)
            .filter(a => a.month === month)
            .map(a => ({ amount: a.amount, currency: allocationCurrency(p), date: p.date, service: p.service })),
        );
  // Serviciile (B3): o plată de Bazin nu scade taxa Grădiniței și invers — fiecare linie
  // (taxa lunii / taxele suplimentare) e acoperită doar de plățile serviciului ei. O plată
  // fără `service` (index/fixturi vechi) se tratează ca Grădiniță, ca înainte de B3. Un
  // serviciu nesistem (nou, liber) nu are obligație — plățile lui nu scad nimic aici.
  const feePaidEntries = paidEntries.filter(e => (e.service ?? DEFAULT_SERVICE_ID) === DEFAULT_SERVICE_ID);
  const chargesPaidEntries = paidEntries.filter(e => e.service === POOL_SERVICE_ID);
  const feePaid = sumEntriesInCurrency(feePaidEntries, feeCurrency, rates);
  const chargesPaid = chargesPaidEntries.length ? sumEntriesInCurrency(chargesPaidEntries, feeCurrency, rates) : 0;
  const paid = feePaid === null || chargesPaid === null ? null : Math.round((feePaid + chargesPaid) * 100) / 100;
  const childCharges = (charges || []).filter(c => c.childId === child.id && c.month === month);
  const chargesTotal = childCharges.length ? sumEntriesInCurrency(childCharges, feeCurrency, rates) : 0;
  const unknown = (!inactive && (!start || !status || fee === null)) || paid === null || chargesTotal === null;
  const expected = unknown ? null : inactive ? 0 : Math.round(((fee ?? 0) + chargesTotal) * 100) / 100;
  const rest = expected === null ? null : Math.max(0, cents(expected) - cents(paid)) / 100;
  const credit = expected === null ? null : Math.max(0, cents(paid) - cents(expected)) / 100;
  const [year, m] = month.split('-').map(Number);
  const lastDay = new Date(year, m, 0).getDate();
  const due = `${month}-${String(Math.min(dueDayFor(child), lastDay)).padStart(2, '0')}`;
  const noticeFrom = shiftDays(due, -NOTICE_DAYS);
  // Ce trebuie notificat: orice rest dintr-o obligație cunoscută, indiferent
  // cât de aproape e scadența. O fișă incompletă nu produce notificări pe baza
  // unei presupuneri; trebuie marcată explicit pentru verificare.
  const notify = !inactive && !unknown && rest !== null && rest > 0;
  const daysToDue = daysBetween(asOf, due);
  const label = unknown
    ? 'De verificat'
    : inactive
      ? 'Fără obligație'
      : rest === 0
        ? 'Plătit'
        : asOf > due
          ? 'Restanță'
          : paid > 0
            ? 'Plată parțială'
            : asOf >= noticeFrom
              ? 'Scadent în curând'
              : 'Nescadent';
  // lines: taxa lunii + fiecare taxă suplimentară (Bazin ș.a.), fiecare cu propria monedă —
  // Situația plăților/fișa/confirmarea le arată separat, nu convertite/adunate (18-sincronizare
  // arată doar suma cunoscută pe fișă; conversia din chargesTotal e doar pentru rest/expected).
  const lines =
    unknown || inactive
      ? []
      : [{ kind: /** @type {'fee'} */ ('fee'), amount: fee, currency: feeCurrency }, ...childCharges];
  return { expected, paid, rest, credit, due, label, notify, daysToDue, currency: feeCurrency, feeAmount: fee, lines };
}
/** Luna calendaristică următoare lui `month` ("AAAA-LL"). */
export function nextMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

// Prima lună cu obligație reală neachitată (nu „De verificat” sau „Fără
// obligație”) — încasarea sosește adesea într-o lună pt. taxa lunii
// anterioare, deci implicit propunem luna care chiar mai trebuie plătită,
// nu luna în care a intrat cash-ul.
export function firstUnpaidMonth(child, payments, charges = [], asOf = today()) {
  const start = child.attendanceDate?.slice(0, 7);
  if (!start) return null;
  const limit = asOf.slice(0, 7);
  let month = start;
  // 120 de luni (10 ani): peste durata obișnuită de frecventare a unei grădinițe.
  for (let i = 0; i < 120 && month <= limit; i++) {
    if ((obligation(child, month, payments, charges, asOf).rest ?? 0) > 0) return month;
    month = nextMonth(month);
  }
  return null;
}

// F7 (FEEDBACK-01-10.md): lunile trecute (strict înainte de `beforeMonth`, de regulă luna
// plății) cu obligație neachitată — afișate separat în formular ca „Are restanță”, cu bifă
// opțională, nu bifate automat ca înainte (firstUnpaidMonth rămâne, dar nu mai e implicit).
export function arrears(child, payments, charges = [], beforeMonth, asOf = today()) {
  const start = child.attendanceDate?.slice(0, 7);
  if (!start || !beforeMonth) return [];
  const result = [];
  let month = start;
  for (let i = 0; i < 120 && month < beforeMonth; i++) {
    const info = obligation(child, month, payments, charges, asOf);
    if ((info.rest ?? 0) > 0) result.push({ month, rest: info.rest, currency: info.currency });
    month = nextMonth(month);
  }
  return result;
}
