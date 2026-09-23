import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { obligation } from '#shared/domain/tuition-obligation.mjs';
import { startTestApplication } from '#test-support/start-test-application.mjs';

async function startApplication(t, prefix, options = {}) {
  const { dir, get, postJson } = await startTestApplication(t, { prefix, ...options });
  return { dir, backupDir: join(dir, 'backups'), get, post: postJson };
}

test('Completarea în masă face fișele evaluabile și e o singură operațiune', async t => {
  const app = await startApplication(t, 'startica-taxe-', { autoBackupIntervalMs: 0 });
  const children = ['A', 'B'].map((n, i) =>
    normalizeRecord('children', {
      id: 'CSV-' + (i + 1),
      contractNumber: String(i + 1),
      name: 'Copil ' + n,
      status: 'De verificat',
      contractDate: '2025-01-14',
      attendanceDate: '2025-02-03',
    }),
  );
  let response = await app.post('/api/import', {
    state: { children, payments: [], expenses: [], groups: [], categories: [], visits: [] },
    confirm: 'IMPORT',
    revision: 0,
    requestId: randomUUID(),
  });
  assert.equal(response.ok, true, response.error);

  // Înainte: fără taxă și fără statut, nimic nu se poate calcula.
  const before = obligation(response.state.children[0], '2026-09', [], '2026-09-30');
  assert.equal(before.label, 'De verificat');
  assert.equal(before.notify, false);

  response = await app.post('/api/record', {
    type: 'groups',
    mode: 'create',
    record: { id: 'GRP-mica', name: 'Grupa mică', capacity: null },
    revision: response.revision,
    requestId: randomUUID(),
  });
  assert.equal(response.ok, true, response.error);

  const updates = children.map(c => ({ id: c.id, fee: 2000, from: '2025-02', groupId: 'GRP-mica', status: 'Activ' }));
  response = await app.post('/api/children-setup', { updates, revision: response.revision, requestId: randomUUID() });
  assert.equal(response.ok, true, response.error);

  const after = obligation(response.state.children[0], '2026-09', [], '2026-09-30');
  assert.equal(after.label, 'Restanță');
  assert.equal(after.notify, true);
  assert.equal(after.expected, 2000);
  assert.equal(after.due, '2026-09-14', 'Scadența vine tot din data contractului.');
  assert.equal(response.state.children[0].groupId, 'GRP-mica');
  assert.deepEqual(response.state.children[0].feeHistory, [{ from: '2025-02', amount: 2000, currency: 'MDL' }]);
  assert.deepEqual(response.state.children[0].statusHistory, [{ from: '2025-02', status: 'Activ' }]);

  // O singură revizie pentru toate fișele, plus copia obligatorie și jurnalul.
  assert.equal(response.revision, 3, 'Toate completările intră într-o singură operațiune.');
  assert.ok(readdirSync(app.backupDir).some(n => n.includes('inainte-completare-taxe')));
  const audit = await app.get('/api/audit');
  assert.equal(audit.entries.filter(entry => entry.action === 'completare taxe și grupe').length, 2);

  // Un id inexistent oprește tot; nimic nu se scrie pe jumătate.
  const bad = await app.post('/api/children-setup', {
    updates: [
      { id: 'CSV-1', fee: 3000, from: '2025-02' },
      { id: 'LIPSA', fee: 1, from: '2025-02' },
    ],
    revision: response.revision,
    requestId: randomUUID(),
  });
  assert.match(bad.error, /nu mai există/);
  const state = await app.get('/api/state');
  assert.equal(state.state.children[0].fee, 2000, 'Prima fișă nu a fost modificată.');
  assert.equal(state.revision, response.revision, 'Revizia nu s-a schimbat.');
});
