export function allocations(p) {
  return p.allocations ?? (p.month ? [{ month: p.month, amount: p.amount }] : []);
}
export function paymentTenders(p) {
  return p.tenders ?? [{ method: p.method || 'Cash', amount: p.amount || 0 }];
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
