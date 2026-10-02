import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startTestApplication } from '#test-support/start-test-application.mjs';
import { runB3PoolExpensesMigration } from './b3-pool-expenses-to-payments.mjs';

// AUDIT-COD-02-10-B.md #3 — script fără test până acum, deși rulat o dată pe date reale
// (30.09, 143/143, vezi docs/design/COADA-DE-LUCRU.md). Niciodată rulat aici cu --execute
// împotriva datelor reale: fiecare test pornește o aplicație nouă, pe un folder temporar.

async function startApp(t, options = {}) {
  const { dir, origin, postJson } = await startTestApplication(t, options);
  return { dir, origin, post: postJson };
}

/** O cheltuială „Bazin" nearhivată, exact forma pe care o caută isPoolExpenseCandidate. */
function poolExpense({ id, date, amount, description = 'Achitare bazin' }) {
  return { id, date, category: 'Bazin', description, amount, method: 'cash' };
}

test('dry-run raportează candidatele fără să scrie nimic', async t => {
  const app = await startApp(t);
  const imported = await app.post('/api/import', {
    state: {
      children: [],
      payments: [],
      expenses: [poolExpense({ id: 'EXP-1', date: '2026-06-02', amount: 500 })],
      groups: [],
      categories: [],
      visits: [],
    },
    confirm: 'IMPORT',
    revision: 0,
    requestId: randomUUID(),
  });
  assert.equal(imported.ok, true, imported.error);

  const lines = [];
  const result = await runB3PoolExpensesMigration({
    home: app.dir,
    baseUrl: app.origin,
    dryRun: true,
    log: l => lines.push(l),
  });

  assert.deepEqual(result, { migrated: 0, skipped: 0, movedAmount: 0, failed: [] });
  assert.ok(lines.some(line => line.includes('EXP-1')));

  const direct = await (await fetch(app.origin + '/api/state')).json();
  assert.equal(direct.state.expenses[0].archived, undefined);
  assert.equal(direct.state.payments.length, 0);
});

test('--execute mută o cheltuială de bazin în Achitări și arhivează sursa, idempotent la rerulare', async t => {
  const app = await startApp(t);
  const imported = await app.post('/api/import', {
    state: {
      children: [],
      payments: [],
      expenses: [poolExpense({ id: 'EXP-1', date: '2026-06-02', amount: 500 })],
      groups: [],
      categories: [],
      visits: [],
    },
    confirm: 'IMPORT',
    revision: 0,
    requestId: randomUUID(),
  });
  assert.equal(imported.ok, true, imported.error);

  const first = await runB3PoolExpensesMigration({ home: app.dir, baseUrl: app.origin, dryRun: false, log: () => {} });
  assert.equal(first.migrated, 1);
  assert.equal(first.failed.length, 0);

  const afterFirst = await (await fetch(app.origin + '/api/state')).json();
  const expense = afterFirst.state.expenses.find(e => e.id === 'EXP-1');
  assert.equal(expense.archived, true);
  assert.match(expense.notes, /mutată la Achitări · PAY-B3-1/);
  const payment = afterFirst.state.payments.find(p => p.id === 'PAY-B3-1');
  assert.ok(payment, 'plata nouă trebuia creată');
  assert.equal(payment.amount, 500);
  assert.equal(payment.childId, '');
  assert.equal(payment.service, 'bazin');

  // A doua rulare: candidata e deja arhivată, deci isPoolExpenseCandidate n-o mai selectează
  // deloc (filtrul exclude arhivatele) — „nimic de migrat”, nu un „sărit” per-item.
  const second = await runB3PoolExpensesMigration({ home: app.dir, baseUrl: app.origin, dryRun: false, log: () => {} });
  assert.equal(second.migrated, 0);
  assert.equal(second.skipped, 0);
});

test('--execute: un conflict pe o cheltuială nu oprește restul lotului, e raportat și reparabil cu o rerulare', async t => {
  const app = await startApp(t);
  const imported = await app.post('/api/import', {
    state: {
      children: [],
      payments: [],
      expenses: [
        poolExpense({ id: 'EXP-OK', date: '2026-06-02', amount: 500 }),
        poolExpense({ id: 'EXP-FAIL', date: '2026-06-03', amount: 300 }),
      ],
      groups: [],
      categories: [],
      visits: [],
    },
    confirm: 'IMPORT',
    revision: 0,
    requestId: randomUUID(),
  });
  assert.equal(imported.ok, true, imported.error);

  const realFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = realFetch;
  });
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith('/api/record') && options?.method === 'POST') {
      const body = JSON.parse(/** @type {string} */ (options.body));
      if (body.record?.id === 'PAY-B3-FAIL')
        return { ok: false, status: 409, json: async () => ({ error: 'S-a modificat între timp.' }) };
    }
    return realFetch(url, options);
  };

  const lines = [];
  const result = await runB3PoolExpensesMigration({
    home: app.dir,
    baseUrl: app.origin,
    dryRun: false,
    log: l => lines.push(l),
  });

  assert.equal(result.migrated, 1, 'EXP-OK tot trebuie migrată, chiar dacă EXP-FAIL a eșuat');
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].expenseId, 'EXP-FAIL');
  assert.ok(lines.some(line => line.includes('EROARE la EXP-FAIL') && line.includes('continui cu restul')));

  globalThis.fetch = realFetch;
  const state = await (await fetch(app.origin + '/api/state')).json();
  assert.equal(state.state.expenses.find(e => e.id === 'EXP-OK').archived, true);
  assert.equal(state.state.expenses.find(e => e.id === 'EXP-FAIL').archived, undefined);

  // Rerulare, fără interceptare — EXP-FAIL se repară singur.
  const retry = await runB3PoolExpensesMigration({ home: app.dir, baseUrl: app.origin, dryRun: false, log: () => {} });
  assert.equal(retry.migrated, 1);
  assert.equal(retry.failed.length, 0);
});
