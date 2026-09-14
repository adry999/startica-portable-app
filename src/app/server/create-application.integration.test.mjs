import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, renameSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { normalizeRecord, emptyState } from '#shared/domain/record-schema.mjs';
import { createApplication, startTestApplication } from '#test-support/start-test-application.mjs';

const child = () =>
  normalizeRecord('children', {
    id: 'ID-test',
    name: 'Copil test',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    fee: 2000,
    dueDay: 10,
    feeHistory: [{ from: '2026-09', amount: 2000 }],
  });
const payment = () =>
  normalizeRecord('payments', {
    id: 'PAY-test',
    childId: 'ID-test',
    date: '2026-09-08',
    amount: 3000,
    method: 'Cash',
    allocations: [
      { month: '2026-09', amount: 2000 },
      { month: '2026-10', amount: 500 },
    ],
  });

test('API: conflicte, reîncercări, backup, restaurare, jurnal și securitate', async t => {
  // autoBackupIntervalMs: 0 => backup după fiecare scriere, ca înainte de
  // introducerea debounce-ului. Testul verifică mai jos că eșecul copiei locale
  // și al celei externe ajunge la utilizator ca avertizare pe răspunsul salvării.
  const { app, dir, origin, token, get, post } = await startTestApplication(t, { prefix: 'startica-test-' });
  const backupDir = join(dir, 'backups');
  const request = (record, type, revision, mode = 'create') => ({
    record,
    type,
    revision,
    mode,
    requestId: randomUUID(),
  });
  let r = await post('/api/record', request(child(), 'children', 0));
  assert.equal(r.status, 200);
  assert.equal(r.body.revision, 1);
  const pay = request(payment(), 'payments', 1);
  r = await post('/api/record', pay);
  assert.equal(r.status, 200);
  r = await post('/api/record', pay);
  assert.equal(r.body.replayed, true);
  assert.equal(r.body.state.payments.length, 1);
  r = await post(
    '/api/record',
    request(normalizeRecord('expenses', { id: 'EXP-test', date: '2026-09-08', amount: 100 }), 'expenses', 1),
  );
  assert.equal(r.status, 409);
  assert.equal((await get('/api/state')).state.payments.length, 1);
  assert.equal((await post('/api/record', request({}, 'children', 2))).status, 400);
  const withForeignOrigin = await fetch(origin + '/api/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Startica-Token': token, Origin: 'https://example.com' },
    body: '{}',
  });
  assert.equal(withForeignOrigin.status, 403);
  const withoutToken = await fetch(origin + '/api/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Startica-Token': '' },
    body: '{}',
  });
  assert.equal(withoutToken.status, 403);
  assert.equal((await post('/api/state', emptyState())).status, 409);
  const before = await post('/api/backup', {});
  assert.equal(before.status, 200);
  const name = before.body.name;
  const preview = await get('/api/backup-preview?name=' + name);
  assert.equal(preview.paymentTotal, 3000);
  assert.equal((await post('/api/restore', { name, confirm: '', revision: 2, requestId: randomUUID() })).status, 400);
  const archive = request({ ...payment(), archived: true }, 'payments', 2, 'update');
  assert.equal((await post('/api/record', archive)).status, 200);
  const restored = await post('/api/restore', { name, confirm: 'RESTAUREAZA', revision: 3, requestId: randomUUID() });
  assert.equal(restored.status, 200);
  assert.equal(restored.body.state.payments[0].archived, undefined);
  const audit = await get('/api/audit');
  assert.ok(audit.entries.some(entry => entry.action === 'restaurare' && entry.before && entry.after));
  assert.equal(audit.nextBeforeEntryId, null);
  assert.equal((await fetch(origin + '/api/audit?beforeEntryId=0')).status, 400);
  const external = join(dir, 'external');
  mkdirSync(external);
  assert.equal((await post('/api/settings', { externalDir: external })).status, 200);
  const copied = readdirSync(external).find(n => n.endsWith('.db'));
  assert.ok(copied);
  assert.deepEqual(readFileSync(join(external, copied)), readFileSync(join(backupDir, copied)));
  assert.equal((await get('/api/health')).cloudVerified, false);
  renameSync(external, external + '-offline');
  r = await post('/api/record', request({ ...child(), phone: '123' }, 'children', 4, 'update'));
  assert.equal(r.status, 200);
  assert.match(r.body.warning, /extern/);
  renameSync(backupDir, backupDir + '-offline');
  r = await post('/api/record', request({ ...child(), phone: '456' }, 'children', 5, 'update'));
  assert.equal(r.status, 200);
  assert.match(r.body.warning, /backupul local/);
  assert.equal(r.body.state.children[0].phone, '456');
  renameSync(backupDir + '-offline', backupDir);
  assert.equal(
    (
      await post('/api/restore', {
        name: '../startica.db',
        revision: 6,
        confirm: 'RESTAUREAZA',
        requestId: randomUUID(),
      })
    ).status,
    400,
  );
  const invalid = { children: [child(), child()], payments: [], expenses: [], groups: [] };
  assert.equal(
    (await post('/api/import', { state: invalid, confirm: 'IMPORT', revision: 6, requestId: randomUUID() })).status,
    400,
  );
  assert.equal((await get('/api/state')).state.children[0].phone, '456');
  const importRequest = {
    state: { children: [child()], payments: [payment()], expenses: [], groups: [], categories: [] },
    confirm: 'IMPORT',
    revision: 6,
    requestId: randomUUID(),
  };
  r = await post('/api/import', importRequest);
  assert.equal(r.status, 200);
  assert.equal(r.body.revision, 7);
  r = await post('/api/import', importRequest);
  assert.equal(r.body.replayed, true);
  assert.equal(r.body.state.payments.length, 1);
  assert.ok(readdirSync(backupDir).some(name => name.includes('inainte-import')));
  assert.equal(
    (await post('/api/record', request({ ...payment(), archived: true }, 'payments', 7, 'update'))).status,
    200,
  );
  assert.equal(
    (await post('/api/record', request({ ...payment(), archived: false }, 'payments', 8, 'update'))).status,
    200,
  );
  assert.equal((await get('/api/state')).state.payments[0].archived, false);
});
test('Migrarea bazei vechi păstrează datele și creează copie înainte de migrare', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'startica-migration-'));
  mkdirSync(join(dir, 'data'));
  const old = new DatabaseSync(join(dir, 'data/startica.db'));
  old.exec('CREATE TABLE app_state(id INTEGER PRIMARY KEY,payload TEXT)');
  const s = { children: [child()], payments: [payment()], expenses: [], groups: [], categories: [] };
  old.prepare('INSERT INTO app_state VALUES(1,?)').run(JSON.stringify(s));
  old.close();
  const app = createApplication({ dataDir: join(dir, 'data'), backupDir: join(dir, 'backups') });
  assert.deepEqual(app.envelope().state, s);
  assert.ok(readdirSync(join(dir, 'backups')).some(f => f.includes('migrare')));
  app.db.close();
  if (
    resolve(dir).startsWith(resolve(tmpdir()) + '\\startica-migration-') ||
    resolve(dir).startsWith(resolve(tmpdir()) + '/startica-migration-')
  )
    rmSync(dir, { recursive: true, force: true });
});
