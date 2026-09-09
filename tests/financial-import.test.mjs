import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, renameSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { normalizeRecord, emptyState } from '../shared/domain.mjs';
import { financialImportPlan } from '../server/financial-import.mjs';
import { createApplication } from '../startica_server.mjs';
const child = normalizeRecord('children', { id: 'ID-1', name: 'Copil Test', birthDate: '2022-01-01' });
const currentChild = {
  ...child,
  id: 'CSV-1',
  contractNumber: '1',
  parent2: 'Contact păstrat',
  phone2: '060123456',
  fee: 999,
};
const source = {
  format: 'STARTICA_V5',
  sourceName: 'test.xlsx',
  sourceHash: 'a'.repeat(64),
  state: {
    children: [child],
    payments: [
      normalizeRecord('payments', {
        id: 'PAY-1',
        childId: 'ID-1',
        date: '2026-09-08',
        amount: 100,
        method: 'Mixtă',
        notes: 'Sumă provizorie',
        original: 'Text sursă',
        verification: 'De verificat',
      }),
    ],
    expenses: [normalizeRecord('expenses', { id: 'EXP-1', date: '2026-09-08', amount: 50 })],
    groups: [],
    categories: [],
  },
};
test('Istoric: mapare exactă, fără înlocuire, sume provizorii și reimport', () => {
  const current = { ...emptyState(), children: [currentChild] },
    before = structuredClone(current),
    input = structuredClone(source);
  const plan = financialImportPlan(source, current);
  assert.equal(plan.additions.payments[0].childId, 'CSV-1');
  assert.equal(plan.additions.payments[0].amount, 100);
  assert.equal(plan.additions.payments[0].original, 'Text sursă');
  assert.match(plan.additions.payments[0].verification, /PROVIZORIE/);
  assert.equal(plan.additions.payments[0].tenders, undefined);
  assert.deepEqual(current, before);
  assert.deepEqual(source, input);
  const imported = { children: [currentChild], ...plan.additions };
  imported.payments[0].notes = 'Corectat de utilizator';
  const replay = financialImportPlan(source, imported);
  assert.equal(replay.summary.payments, 0);
  assert.equal(replay.skipped.expenses, 1);
  assert.equal(imported.payments[0].notes, 'Corectat de utilizator');
  const changed = structuredClone(source);
  changed.state.payments[0].amount = 200;
  assert.throws(() => financialImportPlan(changed, imported), /sursă modificată/);
  for (const children of [
    [],
    [{ ...currentChild, birthDate: '2023-01-01' }],
    [currentChild, { ...currentChild, id: 'CSV-2' }],
  ])
    assert.throws(() => financialImportPlan(source, { ...current, children }), /corespondență unică/);
  assert.throws(
    () =>
      financialImportPlan(source, {
        ...current,
        payments: [{ ...plan.additions.payments[0], importSource: undefined }],
      }),
    /ID deja existent/,
  );
  const unassigned = structuredClone(source);
  unassigned.state.payments[0].childId = '';
  assert.equal(financialImportPlan(unassigned, current).additions.payments[0].childId, '');
});
test('API istoric: atomic, backup obligatoriu, jurnal, idempotent și păstrarea fișelor', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'startica-financial-test-')),
    backupDir = join(dir, 'backups'),
    app = createApplication({ dataDir: join(dir, 'data'), backupDir });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const token = (await (await fetch(url + '/api/session')).json()).token;
    const post = async (path, b) => {
      const r = await fetch(url + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Startica-Token': token },
        body: JSON.stringify(b),
      });
      return { status: r.status, body: await r.json() };
    };
    assert.equal(
      (
        await post('/api/record', {
          record: currentChild,
          type: 'children',
          mode: 'create',
          revision: 0,
          requestId: randomUUID(),
        })
      ).status,
      200,
    );
    const before = app.envelope().state.children;
    const preview = await post('/api/financial-preview', source);
    assert.equal(preview.body.summary.payments, 1);
    assert.equal(preview.body.revision, 1);
    assert.equal(app.envelope().state.payments.length, 0);
    const b = { ...source, confirm: 'IMPORT ISTORIC', revision: 1, requestId: randomUUID() };
    assert.equal((await post('/api/financial-import', { ...b, confirm: '' })).status, 400);
    assert.equal((await post('/api/financial-import', { ...b, revision: 0 })).status, 409);
    renameSync(backupDir, backupDir + '-offline');
    assert.equal((await post('/api/financial-import', b)).status, 400);
    assert.equal(app.envelope().state.payments.length, 0);
    renameSync(backupDir + '-offline', backupDir);
    const saved = await post('/api/financial-import', b);
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body.state.children, before);
    assert.equal(saved.body.state.expenses.length, 1);
    assert.equal((await post('/api/financial-import', b)).body.replayed, true);
    assert.equal((await post('/api/financial-import', { ...b, revision: 2, requestId: randomUUID() })).status, 400);
    assert.equal(app.envelope().revision, 2);
    assert.equal(
      app.db.prepare('SELECT count(*) AS n FROM audit_changes WHERE action=?').get('import istoric V5').n,
      2,
    );
    assert.ok(readdirSync(backupDir).some(n => n.includes('inainte-import-istoric')));
  } finally {
    await app.close();
    if (dir.startsWith(join(tmpdir(), 'startica-financial-test-'))) rmSync(dir, { recursive: true, force: true });
  }
});
