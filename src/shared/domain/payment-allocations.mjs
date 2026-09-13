import { cents } from './money.mjs';

export function allocations(p) {
  return p.allocations ?? (p.month ? [{ month: p.month, amount: p.amount }] : []);
}
export function paymentTenders(p) {
  return p.tenders ?? [{ method: p.method || 'Cash', amount: p.amount || 0 }];
}
// Cât s-a încasat, pe copil și pe lună, calculat o singură dată. Fără index,
// obligation() reciteşte toate plățile pentru fiecare copil, deci un tabel cu
// N copii și M plăți costă N×M. asOf nedefinit înseamnă „fără limită de dată”.
export function paymentIndex(payments, asOf) {
  const index = new Map();
  for (const p of payments) {
    if (p.archived || !p.childId || (asOf && p.date > asOf)) continue;
    let months = index.get(p.childId);
    if (!months) index.set(p.childId, (months = new Map()));
    for (const a of allocations(p)) months.set(a.month, (months.get(a.month) || 0) + cents(a.amount));
  }
  return index;
}
