export function allocations(p) {
  return p.allocations ?? (p.month ? [{ month: p.month, amount: p.amount }] : []);
}

export const TENDER_METHODS = ['Cash', 'Card', 'Transfer'];

// Alias-uri văzute în date vechi/importate (fără diacritice, minuscule) — B1: nu mai există
// „Altele”, deci orice text nou trebuie să cadă pe una din cele 3 metode sau să rămână
// nerecunoscut explicit (nu ghicit) pentru copiii de mai jos.
const TENDER_METHOD_ALIASES = {
  cash: 'Cash',
  numerar: 'Cash',
  card: 'Card',
  'card bancar': 'Card',
  pos: 'Card',
  transfer: 'Transfer',
  'transfer bancar': 'Transfer',
  virament: 'Transfer',
};

/** Case/diacritice-insensitiv; metodele necunoscute rămân neschimbate (trimise), ca să fie vizibile ca atare, nu ghicite. */
export function normalizeTenderMethod(method) {
  const raw = String(method ?? '').trim();
  const key = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return TENDER_METHOD_ALIASES[key] ?? raw;
}

export function paymentTenders(p) {
  const tenders = p.tenders ?? [{ method: p.method || 'Cash', amount: p.amount || 0 }];
  return tenders.map(tender => ({ ...tender, method: normalizeTenderMethod(tender.method) }));
}
// Moneda efectivă a repartizărilor unei plăți: EUR când plata are amountEur
// îngheţat la salvare (taxa copilului era EUR la data plății, spec 16 regula
// 5-6 — allocations[].amount e deja în € în acest caz, cf. PaymentFormDrawer),
// altfel moneda plății (MDL implicit, comportament vechi neschimbat).
export function allocationCurrency(p) {
  return p.amountEur !== undefined ? 'EUR' : p.currency || 'MDL';
}
// Cât s-a încasat, pe copil și pe lună, calculat o singură dată. Fiecare intrare
// își păstrează moneda și data — nu se adună aici, ca obligation() să poată
// converti fiecare la cursul zilei ei, nu la un curs unic pentru toată luna.
// Fără index, obligation() reciteşte toate plățile pentru fiecare copil, deci
// un tabel cu N copii și M plăți costă N×M. asOf nedefinit înseamnă „fără limită de dată”.
export function paymentIndex(payments, asOf) {
  const index = new Map();
  for (const p of payments) {
    if (p.archived || !p.childId || (asOf && p.date > asOf)) continue;
    let months = index.get(p.childId);
    if (!months) index.set(p.childId, (months = new Map()));
    for (const a of allocations(p)) {
      const list = months.get(a.month) ?? [];
      list.push({ amount: a.amount, currency: allocationCurrency(p), date: p.date });
      months.set(a.month, list);
    }
  }
  return index;
}
