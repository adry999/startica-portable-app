// Script de diagnostic B3 (doar citire) — listează cheltuielile care par de fapt încasări
// de bazin (categoria „Bazin” sau descrierea conține „bazin”), ca utilizatorul să confirme
// lista înainte de orice migrare (mutarea lor la Achitări, cf. ALINIERE-DESIGN.md §B3).
// Rulare: node scripts/diagnostic/b3-pool-expenses.mjs [cale-db]
import { DatabaseSync } from 'node:sqlite';
import { comparable } from '../../src/shared/domain/expense-categories.mjs';

const dbPath = process.argv[2] || './Startica_Date/startica.db';
const db = new DatabaseSync(dbPath, { readOnly: true });

const rows = db.prepare("select id, payload from records where kind = 'expenses'").all();

const matches = [];
let totalAmount = 0;

for (const row of rows) {
  const expense = JSON.parse(row.payload);
  const categoryMatch = comparable(String(expense.category || '')) === comparable('Bazin');
  const descriptionMatch = comparable(String(expense.description || '')).includes(comparable('bazin'));
  if (!categoryMatch && !descriptionMatch) continue;
  if (expense.archived) continue; // deja arhivate — nu candidează la migrare activă
  matches.push({
    id: expense.id,
    date: expense.date,
    category: expense.category,
    description: expense.description,
    method: expense.method ?? null,
    amount: expense.amount,
    matchedBy: categoryMatch ? 'categorie' : 'descriere',
  });
  totalAmount += expense.amount;
}

matches.sort((a, b) => a.date.localeCompare(b.date));

console.log(`Total cheltuieli (nearhivate): ${rows.length}`);
console.log(`Candidate „încasare de bazin mutată greșit la Cheltuieli”: ${matches.length}`);
console.log(`Suma totală: ${totalAmount.toFixed(2)} lei`);
console.log('\nListă completă (id, dată, categorie, descriere, metodă, sumă, potrivit după):');
for (const m of matches) {
  console.log(JSON.stringify(m));
}

if (matches.length === 0) {
  console.log('\nNicio candidată găsită — nimic de migrat la §B3.');
}
