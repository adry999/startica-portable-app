import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { startTestApplication } from '#test-support/start-test-application.mjs';

// Testele lovesc rutele HTTP, nu funcția: acoperă și înregistrarea rutei în create-branch-context.mjs.

async function startApplication(t) {
  return startTestApplication(t, { prefix: 'startica-undo-test-' });
}

/** Ultima intrare din istoric — cea mai nouă, cum o întoarce GET /api/audit. */
async function latestAuditEntry(app) {
  const page = await app.get('/api/audit');
  return page.entries[0];
}

test('anulează o cheltuială nou-creată — dispare din evidență', async t => {
  const app = await startApplication(t);
  const state0 = await app.get('/api/state');
  const expense = normalizeRecord('expenses', { id: 'E1', date: '2026-10-02', amount: 150 });

  const created = await app.post('/api/record', {
    type: 'expenses',
    mode: 'create',
    record: expense,
    revision: state0.revision,
    requestId: randomUUID(),
  });
  assert.equal(created.status, 200, created.body.error);
  const entry = await latestAuditEntry(app);
  assert.equal(entry.recordId, 'E1');

  const undone = await app.post('/api/undo', {
    auditId: entry.id,
    revision: created.body.revision,
    requestId: randomUUID(),
  });

  assert.equal(undone.status, 200, undone.body.error);
  assert.deepEqual(undone.body.state.expenses, []);
});

test('anulează o actualizare — readuce valorile vechi, nu doar le șterge', async t => {
  const app = await startApplication(t);
  const state0 = await app.get('/api/state');
  const expense = normalizeRecord('expenses', { id: 'E1', date: '2026-10-02', amount: 150 });
  const created = await app.post('/api/record', {
    type: 'expenses',
    mode: 'create',
    record: expense,
    revision: state0.revision,
    requestId: randomUUID(),
  });

  const updated = await app.post('/api/record', {
    type: 'expenses',
    mode: 'update',
    record: { ...expense, amount: 999 },
    revision: created.body.revision,
    requestId: randomUUID(),
  });
  assert.equal(updated.status, 200, updated.body.error);
  const entry = await latestAuditEntry(app);
  assert.equal(entry.action, 'modificare');

  const undone = await app.post('/api/undo', {
    auditId: entry.id,
    revision: updated.body.revision,
    requestId: randomUUID(),
  });

  assert.equal(undone.status, 200, undone.body.error);
  assert.equal(undone.body.state.expenses[0].amount, 150);
});

test('anularea scrie o nouă intrare în istoric, nu rescrie/șterge pe cea anulată (C2)', async t => {
  const app = await startApplication(t);
  const state0 = await app.get('/api/state');
  const expense = normalizeRecord('expenses', { id: 'E1', date: '2026-10-02', amount: 150 });
  const created = await app.post('/api/record', {
    type: 'expenses',
    mode: 'create',
    record: expense,
    revision: state0.revision,
    requestId: randomUUID(),
  });
  const entry = await latestAuditEntry(app);

  await app.post('/api/undo', { auditId: entry.id, revision: created.body.revision, requestId: randomUUID() });

  const page = await app.get('/api/audit');
  assert.equal(page.entries.length, 2);
  assert.match(page.entries[0].action, /^anulare:/);
  assert.equal(page.entries[1].id, entry.id);
  assert.equal(page.entries[1].action, 'adăugare');
});

test('refuză anularea dacă înregistrarea a fost modificată din nou între timp (409)', async t => {
  const app = await startApplication(t);
  const state0 = await app.get('/api/state');
  const expense = normalizeRecord('expenses', { id: 'E1', date: '2026-10-02', amount: 150 });
  const created = await app.post('/api/record', {
    type: 'expenses',
    mode: 'create',
    record: expense,
    revision: state0.revision,
    requestId: randomUUID(),
  });
  const entry = await latestAuditEntry(app);

  const updated = await app.post('/api/record', {
    type: 'expenses',
    mode: 'update',
    record: { ...expense, amount: 300 },
    revision: created.body.revision,
    requestId: randomUUID(),
  });
  assert.equal(updated.status, 200, updated.body.error);

  const undone = await app.post('/api/undo', {
    auditId: entry.id,
    revision: updated.body.revision,
    requestId: randomUUID(),
  });

  assert.equal(undone.status, 409);
  assert.match(undone.body.error, /S-a modificat între timp/);
});

test('refuză anularea unui id de istoric inexistent (404)', async t => {
  const app = await startApplication(t);
  const state0 = await app.get('/api/state');

  const result = await app.post('/api/undo', { auditId: 999999, revision: state0.revision, requestId: randomUUID() });

  assert.equal(result.status, 404);
});

test('refuză anularea unei intrări fără înregistrare legată (ex. datele grădiniței)', async t => {
  const app = await startApplication(t);
  const state0 = await app.get('/api/state');
  // Salvarea datelor grădiniței (configurare, fără kind/recordId) scrie o intrare de istoric
  // fără înregistrare legată — exact genul care nu are ce să „anuleze” generic (recordType null).
  const saved = await app.post('/api/kindergarten', { name: 'Startica' });
  assert.equal(saved.status, 200, saved.body.error);
  const entry = await latestAuditEntry(app);
  assert.equal(entry.recordType, null);

  const result = await app.post('/api/undo', { auditId: entry.id, revision: state0.revision, requestId: randomUUID() });

  assert.equal(result.status, 409);
  assert.match(result.body.error, /nu poate fi anulată/);
});
