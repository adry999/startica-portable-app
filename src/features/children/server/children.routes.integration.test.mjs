import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readdirSync, renameSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { startTestApplication } from '#test-support/start-test-application.mjs';

const csv =
  'ID (Nr. contract),Nume copil,Parinte,Telefon,Data nasterii,Data frecventarii,Parinte 2,Telefon 2\n1,Copil test,Parinte unu,060123456,01.01.2022,01.09.2026,Parinte doi,+37360123457';

test('API CSV: import atomic, backup, jurnal, protecție la conflicte și reîncercare', async t => {
  const { app, dir, post } = await startTestApplication(t, { prefix: 'startica-children-csv-test-' });
  const expense = normalizeRecord('expenses', { id: 'E1', date: '2026-09-08', amount: 123 });
  await post('/api/record', {
    type: 'expenses',
    mode: 'create',
    record: expense,
    requestId: randomUUID(),
    revision: 0,
  });
  const payment = normalizeRecord('payments', { id: 'P1', date: '2026-09-08', amount: 456, method: 'Card' });
  await post('/api/record', {
    type: 'payments',
    mode: 'create',
    record: payment,
    requestId: randomUUID(),
    revision: 1,
  });
  const preview = await post('/api/children-csv-preview', { csv });
  assert.equal(preview.body.revision, 2);
  assert.equal(preview.body.additions.length, 1);
  assert.equal(app.envelope().revision, 2);
  const body = { csv, confirm: 'IMPORT COPII', revision: 2, requestId: randomUUID() };
  assert.equal((await post('/api/children-csv', { ...body, confirm: '' })).status, 400);
  assert.equal((await post('/api/children-csv', { ...body, revision: 1 })).status, 409);
  renameSync(join(dir, 'backups'), join(dir, 'offline'));
  const backupFailure = await post('/api/children-csv', body);
  assert.equal(backupFailure.status, 500);
  assert.match(backupFailure.body.error, /Backupul de siguranță dinaintea operației nu a putut fi creat/);
  assert.equal(app.envelope().state.children.length, 0);
  renameSync(join(dir, 'offline'), join(dir, 'backups'));
  const r = await post('/api/children-csv', body);
  assert.equal(r.status, 200);
  assert.equal(r.body.state.children.length, 1);
  assert.deepEqual(r.body.state.payments, [payment]);
  assert.deepEqual(r.body.state.expenses, [expense]);
  assert.equal((await post('/api/children-csv', body)).body.replayed, true);
  assert.equal((await post('/api/children-csv-preview', { csv })).body.skipped, 1);
  assert.equal((await post('/api/children-csv', { ...body, revision: 3, requestId: randomUUID() })).status, 400);
  assert.equal(app.envelope().revision, 3);
  const backup = readdirSync(join(dir, 'backups')).find(n => n.includes('inainte-import-copii'));
  assert.ok(backup);
  const db = new DatabaseSync(join(dir, 'backups', backup), { readOnly: true });
  assert.equal(db.prepare("SELECT count(*) AS n FROM records WHERE kind='children'").get().n, 0);
  db.close();
  const audit = app.db.prepare("SELECT * FROM audit_changes WHERE action='import copii CSV'").all();
  assert.equal(audit.length, 1);
  const invalid = await post('/api/children-csv', {
    csv: csv.replace('01.01.2022', 'bad date'),
    confirm: 'IMPORT COPII',
    revision: 3,
    requestId: randomUUID(),
  });
  assert.equal(invalid.status, 400);
  assert.equal(app.envelope().revision, 3);
});
