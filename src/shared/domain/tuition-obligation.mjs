import { today, shiftDays, daysBetween } from './calendar-month.mjs';
import { cents } from './money.mjs';
import { allocations } from './payment-allocations.mjs';
import { eurToMdlRate, convertAmount } from './exchange-rates.mjs';

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
// `index` este opțional: dacă lipsește, se calculează pe loc, ca apelurile
// izolate (un singur copil, o singură lună) să rămână simple.
/** @param {Map<string, Map<string, {amount: number, currency: import('#shared/contracts/record-types.mjs').Currency, date: string}[]>> | null} [index] */
export function obligation(child, month, payments, asOf = today(), index = null, rates = {}) {
  const start = child.attendanceDate?.slice(0, 7),
    end = child.withdrawalDate?.slice(0, 7);
  const history = [...(child.statusHistory || [])]
    .sort((a, b) => a.from.localeCompare(b.from))
    .filter(r => r.from <= month);
  const status = history.at(-1)?.status || (!child.statusHistory?.length && child.status === 'Activ' ? 'Activ' : null);
  const inactive = (start && month < start) || (end && month > end) || status === 'Suspendat' || status === 'Retras';
  const fees = [...(child.feeHistory || [])].sort((a, b) => a.from.localeCompare(b.from));
  // O taxă curentă fără dată de aplicare nu se aplică niciodată lunilor trecute.
  const feeEntry = fees.filter(f => f.from <= month).at(-1) ?? null;
  const fee = feeEntry?.amount ?? null;
  const feeCurrency = feeEntry?.currency ?? 'MDL';
  const paidEntries = index
    ? (index.get(child.id)?.get(month) ?? [])
    : payments
        .filter(p => !p.archived && p.childId === child.id && p.date <= asOf)
        .flatMap(p =>
          allocations(p)
            .filter(a => a.month === month)
            .map(a => ({ amount: a.amount, currency: p.currency || 'MDL', date: p.date })),
        );
  const paid = sumEntriesInCurrency(paidEntries, feeCurrency, rates);
  const unknown = !inactive && (!start || !status || fee === null || paid === null);
  const expected = inactive ? 0 : unknown ? null : fee;
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
  const label = inactive
    ? 'Fără obligație'
    : unknown
      ? 'De verificat'
      : rest === 0
        ? 'Plătit'
        : asOf > due
          ? 'Restanță'
          : paid > 0
            ? 'Plată parțială'
            : asOf >= noticeFrom
              ? 'Scadent în curând'
              : 'Nescadent';
  return { expected, paid, rest, credit, due, label, notify, daysToDue };
}
// Prima lună cu obligație reală neachitată (nu „De verificat” sau „Fără
// obligație”) — încasarea sosește adesea într-o lună pt. taxa lunii
// anterioare, deci implicit propunem luna care chiar mai trebuie plătită,
// nu luna în care a intrat cash-ul.
export function firstUnpaidMonth(child, payments, asOf = today()) {
  const start = child.attendanceDate?.slice(0, 7);
  if (!start) return null;
  const limit = asOf.slice(0, 7);
  let month = start;
  // 120 de luni (10 ani): peste durata obișnuită de frecventare a unei grădinițe.
  for (let i = 0; i < 120 && month <= limit; i++) {
    if ((obligation(child, month, payments, asOf).rest ?? 0) > 0) return month;
    const [y, m] = month.split('-').map(Number);
    month = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  }
  return null;
}
