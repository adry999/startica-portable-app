import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { obligation } from '#shared/domain/tuition-obligation.mjs';
import { startTestApplication } from '#test-support/start-test-application.mjs';

// Helper pentru testele care vorbesc cu serverul prin HTTP.
async function startApplication(t, prefix, options = {}) {
  const { dir, get, postJson } = await startTestApplication(t, { prefix, ...options });
  return { dir, backupDir: join(dir, 'backups'), get, post: postJson };
}

test('Asocierea în masă leagă achitările și nu suprascrie una deja atribuită', async t => {
  const app = await startApplication(t, 'startica-asoc-', { autoBackupIntervalMs: 0 });
  const child = normalizeRecord('children', {
    id: 'CSV-1',
    name: 'Florea Mark',
    status: 'Activ',
    contractDate: '2025-01-14',
    attendanceDate: '2025-02-01',
    feeHistory: [{ from: '2025-02', amount: 12000 }],
    statusHistory: [{ from: '2025-02', status: 'Activ' }],
  });
  const payments = [
    normalizeRecord('payments', {
      id: 'PAY-1',
      date: '2026-09-01',
      amount: 12000,
      sourceName: 'Mark',
      allocations: [{ month: '2026-09', amount: 12000 }],
    }),
    normalizeRecord('payments', {
      id: 'PAY-2',
      childId: 'CSV-1',
      date: '2026-08-01',
      amount: 12000,
      allocations: [{ month: '2026-08', amount: 12000 }],
    }),
  ];
  let r = await app.post('/api/import', {
    state: { children: [child], payments, expenses: [], groups: [], categories: [] },
    confirm: 'IMPORT',
    revision: 0,
    requestId: randomUUID(),
  });
  assert.equal(r.ok, true, r.error);

  // Neasociată => copilul apare ca restanțier deși banii au intrat.
  assert.equal(obligation(r.state.children[0], '2026-09', r.state.payments, '2026-09-30').notify, true);

  r = await app.post('/api/payments-assign', {
    assignments: [{ id: 'PAY-1', childId: 'CSV-1' }],
    revision: r.revision,
    requestId: randomUUID(),
  });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.state.payments.find(p => p.id === 'PAY-1').childId, 'CSV-1');
  assert.equal(
    obligation(r.state.children[0], '2026-09', r.state.payments, '2026-09-30').notify,
    false,
    'După asociere, copilul nu mai este pe lista de notificat.',
  );
  assert.ok(readdirSync(app.backupDir).some(n => n.includes('inainte-asociere-achitari')));

  // O achitare deja atribuită nu poate fi reasociată din greșeală de aici.
  const refused = await app.post('/api/payments-assign', {
    assignments: [{ id: 'PAY-2', childId: 'CSV-1' }],
    revision: r.revision,
    requestId: randomUUID(),
  });
  assert.match(refused.error, /are deja un copil asociat/);
  // Un copil inexistent oprește tot.
  const bad = await app.post('/api/payments-assign', {
    assignments: [{ id: 'PAY-1', childId: 'LIPSA' }],
    revision: r.revision,
    requestId: randomUUID(),
  });
  assert.ok(bad.error, 'Asocierea către un copil inexistent este respinsă.');
});
