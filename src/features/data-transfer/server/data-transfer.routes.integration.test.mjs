import test from 'node:test';
import assert from 'node:assert/strict';
import { renameSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { startTestApplication } from '#test-support/start-test-application.mjs';
import { currentMatchingChild, v5FinancialSource } from '../test-support/financial-history-fixtures.mjs';

test('API istoric: atomic, backup obligatoriu, jurnal, idempotent și păstrarea fișelor', async t => {
  const currentChild = currentMatchingChild(),
    source = v5FinancialSource();
  const { app, dir, post } = await startTestApplication(t, { prefix: 'startica-financial-test-' });
  const backupDir = join(dir, 'backups');
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
  const backupFailure = await post('/api/financial-import', b);
  assert.equal(backupFailure.status, 500);
  assert.match(backupFailure.body.error, /Backupul de siguranță dinaintea operației nu a putut fi creat/);
  assert.equal(app.envelope().state.payments.length, 0);
  renameSync(backupDir + '-offline', backupDir);
  const saved = await post('/api/financial-import', b);
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.state.children, before);
  assert.equal(saved.body.state.expenses.length, 1);
  assert.equal((await post('/api/financial-import', b)).body.replayed, true);
  assert.equal((await post('/api/financial-import', { ...b, revision: 2, requestId: randomUUID() })).status, 400);
  assert.equal(app.envelope().revision, 2);
  assert.equal(app.db.prepare('SELECT count(*) AS n FROM audit_changes WHERE action=?').get('import istoric V5').n, 2);
  assert.ok(readdirSync(backupDir).some(n => n.includes('inainte-import-istoric')));
});
