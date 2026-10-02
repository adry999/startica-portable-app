import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { convertAmount } from '#shared/domain/exchange-rates.mjs';
import { startTestApplication } from '#test-support/start-test-application.mjs';
import { runFxRateBackfillMigration, evaluatePayment } from './fxrate-backfill.mjs';

// PROMPT-9 §9 — niciodată rulat cu --execute împotriva datelor reale: fiecare test de mai jos
// pornește o aplicație nouă, pe un folder temporar de unică folosință (startTestApplication).
//
// Totul trece prin HTTP (ca normalize-phones.mjs) — scriptul migrat nu atinge niciun fișier SQLite
// direct, deci `home` din `startTestApplication` (folderul temporar) e suficient și pentru
// parametrul `home` al migrării, fără aranjamentul special din
// exchange-rates-plan-presets-to-common.test.mjs (acolo era nevoie de layout-ul real de filiale).

async function startApp(t, options = {}) {
  const { dir, origin, get, postJson } = await startTestApplication(t, options);
  return { dir, origin, get, post: postJson, backupDir: join(dir, 'backups') };
}

/** Copil nou, cu o taxă EUR de la `from`, gata pentru `feeEntryFor`. */
async function createEurChild(app, { id, from, amount = 100 }) {
  const response = await app.post('/api/import', {
    state: {
      children: [
        {
          id,
          contractNumber: id,
          name: 'Copil ' + id,
          status: 'Activ',
          contractDate: '2026-01-10',
          attendanceDate: from + '-01',
        },
      ],
      payments: [],
      expenses: [],
      groups: [],
      categories: [],
      visits: [],
    },
    confirm: 'IMPORT',
    revision: 0,
    requestId: randomUUID(),
  });
  assert.equal(response.ok, true, response.error);
  const setup = await app.post('/api/children-setup', {
    updates: [{ id, fee: amount, from, currency: 'EUR', status: 'Activ' }],
    revision: response.revision,
    requestId: randomUUID(),
  });
  assert.equal(setup.ok, true, setup.error);
  return setup;
}

/** Plată nouă în lei, fără fxRate/amountEur — exact cum arătau plățile vechi (dinainte de F12/F9). */
async function createLegacyPayment(app, revision, { id, childId, date, amount }) {
  const result = await app.post('/api/record', {
    type: 'payments',
    mode: 'create',
    record: { id, childId, date, amount, allocations: [{ month: date.slice(0, 7), amount }] },
    revision,
    requestId: randomUUID(),
  });
  assert.equal(result.ok, true, result.error);
  return result;
}

async function importCommonRates(app, rates, sources) {
  return app.post('/api/exchange-rates/import', { rates, sources });
}

test('fără home, aruncă o eroare clară', async () => {
  await assert.rejects(() => runFxRateBackfillMigration({ home: undefined, log: () => {} }), /home/);
});

test('evaluatePayment: taxă MDL, plată deja completată sau copil lipsă nu sunt aplicabile', () => {
  const rates = { '2026-09-18': 19.8 };
  const sources = { '2026-09-18': 'bnm' };
  const mdlChild = { id: 'C1', feeHistory: [{ from: '2026-01', amount: 1000, currency: 'MDL' }] };
  const eurChild = { id: 'C2', feeHistory: [{ from: '2026-01', amount: 100, currency: 'EUR' }] };

  assert.equal(
    evaluatePayment({ childId: 'C1', date: '2026-09-18', amount: 1000 }, [mdlChild], rates, sources).applicable,
    false,
  );
  assert.equal(
    evaluatePayment({ childId: 'LIPSA', date: '2026-09-18', amount: 1000 }, [eurChild], rates, sources).applicable,
    false,
  );
  assert.equal(
    evaluatePayment({ childId: 'C2', date: '2026-09-18', amount: 1000, fxRate: 19.8 }, [eurChild], rates, sources)
      .applicable,
    false,
  );
  assert.equal(
    evaluatePayment({ childId: 'C2', date: '2026-09-18', amount: 1000, currency: 'EUR' }, [eurChild], rates, sources)
      .applicable,
    false,
  );
});

test('dry-run: raportează corect plata aplicabilă, fără să scrie nimic', async t => {
  const app = await startApp(t);
  const setup = await createEurChild(app, { id: 'C1', from: '2026-01', amount: 100 });
  await importCommonRates(app, { '2026-09-18': 19.8 }, { '2026-09-18': 'bnm' });
  await createLegacyPayment(app, setup.revision, { id: 'PAY-1', childId: 'C1', date: '2026-09-18', amount: 500 });

  const lines = [];
  const result = await runFxRateBackfillMigration({
    home: app.dir,
    baseUrl: app.origin,
    dryRun: true,
    log: l => lines.push(l),
  });

  assert.equal(result.migrated, false);
  assert.equal(result.scanned, 1);
  assert.equal(result.applicable, 1);
  assert.equal(result.resolved, 1);
  assert.ok(lines.some(line => line.includes('PAY-1') && line.includes('19.8') && line.includes('bnm')));
  assert.ok(lines.some(line => line.includes('Dry-run — nimic scris')));

  const { state } = await app.get('/api/state');
  const payment = state.payments.find(p => p.id === 'PAY-1');
  assert.equal(payment.fxRate, undefined);
  assert.equal(payment.amountEur, undefined);
});

test('--execute completează fxRate/amountEur cu exact formula de la salvare (PaymentFormDrawer)', async t => {
  const app = await startApp(t);
  const setup = await createEurChild(app, { id: 'C1', from: '2026-01', amount: 100 });
  // 2026-09-19 (duminică) nu are curs propriu — cade pe cel mai recent cunoscut anterior (18),
  // exact regula lui eurToMdlRate.
  await importCommonRates(app, { '2026-09-18': 19.8 }, { '2026-09-18': 'bnm' });
  await createLegacyPayment(app, setup.revision, { id: 'PAY-1', childId: 'C1', date: '2026-09-19', amount: 500 });

  const result = await runFxRateBackfillMigration({ home: app.dir, baseUrl: app.origin, dryRun: false, log: () => {} });

  assert.equal(result.migrated, true);
  assert.equal(result.written, 1);

  const expectedAmountEur = convertAmount(500, 'MDL', 'EUR', 19.8);
  const { state } = await app.get('/api/state');
  const payment = state.payments.find(p => p.id === 'PAY-1');
  assert.equal(payment.fxRate, 19.8);
  assert.equal(payment.fxRateSource, 'bnm');
  assert.equal(payment.amountEur, expectedAmountEur);
  // amount-ul (lei) nu se atinge — doar metadatele de conversie se adaugă.
  assert.equal(payment.amount, 500);
  // AUDIT-COD-02-10.md, critic: allocations[].amount TREBUIE convertit în € — altfel
  // allocationCurrency() ar citi suma veche în lei ca și cum ar fi deja în €.
  assert.deepEqual(payment.allocations, [{ month: '2026-09', amount: expectedAmountEur }]);

  assert.ok(readdirSync(app.backupDir).length > 0, 'Backup complet luat înainte de scriere.');
});

test('--execute convertește fiecare rând al repartizării pe mai multe luni, fără deviere de la amountEur', async t => {
  const app = await startApp(t);
  const setup = await createEurChild(app, { id: 'C1', from: '2026-01', amount: 100 });
  await importCommonRates(app, { '2026-09-18': 19.8 }, { '2026-09-18': 'bnm' });
  // Repartizare pe 3 luni (restanță + luna curentă + avans), ca la o plată reală multi-lună.
  const result0 = await app.post('/api/record', {
    type: 'payments',
    mode: 'create',
    record: {
      id: 'PAY-MULTI',
      childId: 'C1',
      date: '2026-09-18',
      amount: 300,
      allocations: [
        { month: '2026-07', amount: 100 },
        { month: '2026-08', amount: 100 },
        { month: '2026-09', amount: 100 },
      ],
    },
    revision: setup.revision,
    requestId: randomUUID(),
  });
  assert.equal(result0.ok, true, result0.error);

  const result = await runFxRateBackfillMigration({ home: app.dir, baseUrl: app.origin, dryRun: false, log: () => {} });
  assert.equal(result.written, 1);

  const expectedAmountEur = convertAmount(300, 'MDL', 'EUR', 19.8);
  const { state } = await app.get('/api/state');
  const payment = state.payments.find(p => p.id === 'PAY-MULTI');
  assert.equal(payment.allocations.length, 3);
  assert.equal(payment.allocations[0].month, '2026-07');
  assert.equal(payment.allocations[1].month, '2026-08');
  assert.equal(payment.allocations[2].month, '2026-09');
  // Suma rândurilor convertite cade exact pe amountEur — ultimul rând absoarbe rotunjirea.
  const sum = payment.allocations.reduce((s, row) => s + row.amount, 0);
  assert.equal(Math.round(sum * 100) / 100, expectedAmountEur);
});

test('o plată cu fxRate deja existent rămâne neatinsă', async t => {
  const app = await startApp(t);
  const setup = await createEurChild(app, { id: 'C1', from: '2026-01', amount: 100 });
  await importCommonRates(app, { '2026-09-18': 19.8 }, { '2026-09-18': 'bnm' });
  const created = await app.post('/api/record', {
    type: 'payments',
    mode: 'create',
    record: {
      id: 'PAY-OLD',
      childId: 'C1',
      date: '2026-09-18',
      amount: 500,
      fxRate: 21,
      fxRateSource: 'manual',
      amountEur: 23.81,
      allocations: [{ month: '2026-09', amount: 23.81 }],
    },
    revision: setup.revision,
    requestId: randomUUID(),
  });
  assert.equal(created.ok, true, created.error);

  const result = await runFxRateBackfillMigration({ home: app.dir, baseUrl: app.origin, dryRun: false, log: () => {} });

  assert.equal(result.applicable, 0);
  assert.equal(result.resolved, 0);

  const { state } = await app.get('/api/state');
  const payment = state.payments.find(p => p.id === 'PAY-OLD');
  assert.equal(payment.fxRate, 21);
  assert.equal(payment.fxRateSource, 'manual');
  assert.equal(payment.amountEur, 23.81);
});

test('o plată fără niciun curs cunoscut în istoric e raportată ca nerezolvată, nu crapă', async t => {
  const app = await startApp(t);
  const setup = await createEurChild(app, { id: 'C1', from: '2026-01', amount: 100 });
  // Niciun curs importat — istoricul comun e gol.
  await createLegacyPayment(app, setup.revision, { id: 'PAY-1', childId: 'C1', date: '2026-09-18', amount: 500 });

  const lines = [];
  const dryRunResult = await runFxRateBackfillMigration({
    home: app.dir,
    baseUrl: app.origin,
    dryRun: true,
    log: l => lines.push(l),
  });
  assert.equal(dryRunResult.applicable, 1);
  assert.equal(dryRunResult.resolved, 0);
  assert.deepEqual(dryRunResult.unresolved, [
    { branchId: (await app.get('/api/session')).branch.id, paymentId: 'PAY-1' },
  ]);
  assert.ok(lines.some(line => line.includes('Nerezolvate')));

  const executeResult = await runFxRateBackfillMigration({
    home: app.dir,
    baseUrl: app.origin,
    dryRun: false,
    log: () => {},
  });
  assert.equal(executeResult.written, 0);
  assert.equal(executeResult.unresolved, 1);

  const { state } = await app.get('/api/state');
  const payment = state.payments.find(p => p.id === 'PAY-1');
  assert.equal(payment.fxRate, undefined);
});

test('--execute e idempotent: a doua rulare nu mai scrie nimic și nu schimbă starea', async t => {
  const app = await startApp(t);
  const setup = await createEurChild(app, { id: 'C1', from: '2026-01', amount: 100 });
  await importCommonRates(app, { '2026-09-18': 19.8 }, { '2026-09-18': 'bnm' });
  await createLegacyPayment(app, setup.revision, { id: 'PAY-1', childId: 'C1', date: '2026-09-18', amount: 500 });

  const first = await runFxRateBackfillMigration({ home: app.dir, baseUrl: app.origin, dryRun: false, log: () => {} });
  assert.equal(first.written, 1);
  const stateAfterFirst = (await app.get('/api/state')).state;

  const second = await runFxRateBackfillMigration({ home: app.dir, baseUrl: app.origin, dryRun: false, log: () => {} });
  assert.equal(second.applicable, 0);
  assert.equal(second.written, 0);

  const stateAfterSecond = (await app.get('/api/state')).state;
  assert.deepEqual(
    stateAfterSecond.payments.map(p => ({ id: p.id, fxRate: p.fxRate, amountEur: p.amountEur })),
    stateAfterFirst.payments.map(p => ({ id: p.id, fxRate: p.fxRate, amountEur: p.amountEur })),
  );
});

// AUDIT-COD-02-10.md #7: un conflict pe O plată (ex. 409 de la o editare concurentă a EI) nu
// trebuie să oprească restul lotului — raportat per-plată, idempotent la rerulare, ca la
// exchange-rates-plan-presets-to-common.mjs. Interceptăm fetch global doar pentru scrierea pe
// PAY-FAIL, ca să simulăm un 409 real fără să pornim o a doua filă concurentă.
test('--execute: un conflict pe o plată nu oprește restul lotului, e raportat și reparabil cu o rerulare', async t => {
  const app = await startApp(t);
  const setup = await createEurChild(app, { id: 'C1', from: '2026-01', amount: 100 });
  await importCommonRates(app, { '2026-09-18': 19.8 }, { '2026-09-18': 'bnm' });
  const afterOk = await createLegacyPayment(app, setup.revision, {
    id: 'PAY-OK',
    childId: 'C1',
    date: '2026-09-18',
    amount: 500,
  });
  await createLegacyPayment(app, afterOk.revision, { id: 'PAY-FAIL', childId: 'C1', date: '2026-09-18', amount: 300 });

  const realFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = realFetch;
  });
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith('/api/record') && options?.method === 'POST') {
      const body = JSON.parse(/** @type {string} */ (options.body));
      if (body.record?.id === 'PAY-FAIL')
        return { ok: false, status: 409, json: async () => ({ error: 'S-a modificat între timp.' }) };
    }
    return realFetch(url, options);
  };

  const lines = [];
  const result = await runFxRateBackfillMigration({
    home: app.dir,
    baseUrl: app.origin,
    dryRun: false,
    log: l => lines.push(l),
  });

  assert.equal(result.written, 1, 'PAY-OK tot trebuie scris, chiar dacă PAY-FAIL a eșuat');
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].paymentId, 'PAY-FAIL');
  assert.ok(lines.some(line => line.includes('EROARE la PAY-FAIL') && line.includes('continui cu restul')));

  const { state } = await app.get('/api/state');
  assert.notEqual(state.payments.find(p => p.id === 'PAY-OK').fxRate, undefined);
  assert.equal(state.payments.find(p => p.id === 'PAY-FAIL').fxRate, undefined, 'nimic nu s-a scris pe cea eșuată');

  // Rerulare, de data asta fără interceptare — PAY-FAIL se repară singur, nimic nu s-a pierdut.
  globalThis.fetch = realFetch;
  const retry = await runFxRateBackfillMigration({ home: app.dir, baseUrl: app.origin, dryRun: false, log: () => {} });
  assert.equal(retry.written, 1);
  assert.equal(retry.failed.length, 0);
});
