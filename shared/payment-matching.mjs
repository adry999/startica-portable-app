import { cents, allocations, obligation, paymentIndex } from './domain.mjs';
import { stripDiacritics } from './text.mjs';

const strip = v => stripDiacritics(v).toLowerCase();
// Cuvinte care apar în textul sursei fără să fie nume: luni, metode, note.
const NOISE = new Set([
  'ianuarie',
  'februarie',
  'martie',
  'aprilie',
  'mai',
  'iunie',
  'iulie',
  'august',
  'septembrie',
  'octombrie',
  'noiembrie',
  'decembrie',
  'luna',
  'luni',
  'pentru',
  'plata',
  'achitare',
  'achitat',
  'card',
  'cardul',
  'cash',
  'transfer',
  'numerar',
  'avans',
  'rest',
  'total',
  'sept',
  'oct',
  'nov',
  'dec',
  'ian',
  'feb',
  'mar',
  'apr',
  'iun',
  'iul',
  'aug',
  'gemeni',
  'copil',
  'copii',
  'spre',
]);
const nameTokens = value =>
  strip(value)
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3 && !NOISE.has(t) && !/^\d+$/.test(t));

const feeFor = (child, month) =>
  [...(child.feeHistory || [])]
    .sort((a, b) => a.from.localeCompare(b.from))
    .filter(f => f.from <= month)
    .at(-1)?.amount ?? null;

// Un candidat primește puncte pentru fiecare indiciu independent care se
// potrivește. Nimic nu se asociază automat: scorul doar ordonează sugestiile,
// iar decizia rămâne a operatorului.
export function suggestChildren(payment, children, index, limit = 5) {
  const sourceTokens = new Set([...nameTokens(payment.sourceName), ...nameTokens(payment.childName)]);
  const months = allocations(payment).map(a => a.month);
  const amount = cents(payment.amount);
  const scored = [];
  for (const child of children) {
    if (child.archived) continue;
    let score = 0;
    const reasons = [];

    const shared = [...new Set(nameTokens(child.name))].filter(t => sourceTokens.has(t));
    if (shared.length) {
      score += 3 * shared.length;
      reasons.push(`nume în sursă: ${shared.join(', ')}`);
    }

    const fee = months.length ? feeFor(child, months[0]) : null;
    if (fee !== null && cents(fee) > 0) {
      const ratio = amount / cents(fee);
      if (Number.isInteger(ratio) && ratio >= 1 && ratio <= 12) {
        score += 2;
        reasons.push(ratio === 1 ? 'suma este exact taxa lunară' : `suma este taxa pe ${ratio} luni`);
      }
    }

    const paid = index.get(child.id) || new Map();
    const unpaid = months.filter(m => {
      const f = feeFor(child, m);
      return f !== null && (paid.get(m) || 0) < cents(f);
    });
    if (months.length && unpaid.length === months.length) {
      score += 2;
      reasons.push(months.length === 1 ? `luna ${months[0]} este neachitată` : `toate lunile sunt neachitate`);
    } else if (unpaid.length) {
      score += 1;
      reasons.push(`${unpaid.length} din ${months.length} luni neachitate`);
    }

    if (score > 0)
      scored.push({
        id: child.id,
        name: child.name,
        contractNumber: child.contractNumber,
        score,
        // Doar numele leagă o achitare de un anume copil. Suma și luna
        // neachitată se potrivesc la zeci de copii deodată, deci nu pot susține
        // singure o propunere: fără nameMatch, candidatul e un punct de pornire
        // pentru căutare, niciodată ceva de acceptat în masă.
        nameMatch: shared.length > 0,
        reasons,
      });
  }
  return scored
    .sort((a, b) => b.nameMatch - a.nameMatch || b.score - a.score || a.name.localeCompare(b.name, 'ro'))
    .slice(0, limit);
}

// Achitările fără copil, cu sugestiile lor. Cele mai recente primele: sunt cele
// care afectează situația curentă.
export function unassignedPayments(state, limit = 200) {
  const open = state.payments
    .filter(p => !p.archived && !p.childId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
  const index = paymentIndex(state.payments);
  return open.map(payment => ({ payment, suggestions: suggestChildren(payment, state.children, index) }));
}

// Câți copii ar putea fi raportați greșit ca restanțieri din cauza plăților
// nelegate. Un „de notificat” nu poate fi crezut cât timp cifra asta e mare.
export function assignmentRisk(state, month, asOf) {
  const unassigned = state.payments.filter(p => !p.archived && !p.childId);
  const covering = unassigned.filter(p => allocations(p).some(a => a.month === month));
  // Rulează la fiecare randare a aplicației — indexul evită O(copii×plăți).
  const index = paymentIndex(state.payments, asOf);
  const notified = state.children.filter(
    c => !c.archived && obligation(c, month, state.payments, asOf, index).notify,
  ).length;
  return {
    unassigned: unassigned.length,
    coveringMonth: covering.length,
    amountCoveringMonth: covering.reduce((sum, p) => sum + cents(p.amount), 0) / 100,
    notified,
  };
}
