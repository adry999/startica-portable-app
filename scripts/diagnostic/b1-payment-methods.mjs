// Script de diagnostic B1 (doar citire) — listează plățile ale căror tender-uri nu se încadrează
// exact în Cash/Card/Transfer, ca să vedem ce forme brute există înainte de orice migrare.
// Rulare: node scripts/diagnostic/b1-payment-methods.mjs [cale-db]
import { DatabaseSync } from 'node:sqlite';
import { paymentTenders } from '../../src/shared/domain/payment-allocations.mjs';

const dbPath = process.argv[2] || './Startica_Date/startica.db';
const db = new DatabaseSync(dbPath, { readOnly: true });

const rows = db.prepare("select id, payload from records where kind = 'payments'").all();
const KNOWN = new Set(['Cash', 'Card', 'Transfer']);

const offenders = [];
const rawMethodCounts = new Map();

for (const row of rows) {
  const payment = JSON.parse(row.payload);
  const tenders = paymentTenders(payment);
  const badTenders = tenders.filter(t => !KNOWN.has(t.method));
  if (badTenders.length > 0) {
    offenders.push({
      id: payment.id,
      date: payment.date,
      childId: payment.childId,
      method: payment.method,
      amount: payment.amount,
      tenders: payment.tenders ?? null,
      hasRawMethodFields: {
        cash: payment.cash,
        card: payment.card,
        cashAmount: payment.cashAmount,
        cardAmount: payment.cardAmount,
        transferAmount: payment.transferAmount,
      },
    });
    for (const t of badTenders) {
      rawMethodCounts.set(t.method, (rawMethodCounts.get(t.method) ?? 0) + 1);
    }
  }
}

console.log(`Total plăți: ${rows.length}`);
console.log(`Plăți cu tender necunoscut (→ „Altele”): ${offenders.length}`);
console.log('\nDistribuția valorilor brute de `method` necunoscute:');
for (const [method, count] of [...rawMethodCounts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${JSON.stringify(method)}: ${count}`);
}
console.log('\nPrimele 30 de plăți afectate (id, dată, copil, method brut, sumă, câmpuri brute suplimentare):');
for (const o of offenders.slice(0, 30)) {
  console.log(JSON.stringify(o));
}

if (offenders.length > 30) {
  console.log(`\n… și încă ${offenders.length - 30} plăți.`);
}
