import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { startTestApplication } from '#test-support/start-test-application.mjs';

test('GET /api/diagnostic răspunde 404 fără allowShutdown', async t => {
  const bundle = await startTestApplication(t, { prefix: 'startica-diagnostic-' });
  const response = await fetch(bundle.origin + '/api/diagnostic');
  assert.equal(response.status, 404);
});

test('GET /api/diagnostic întoarce starea aplicației, fără jurnal când nu există home', async t => {
  const bundle = await startTestApplication(t, { prefix: 'startica-diagnostic-', allowShutdown: true });
  const response = await bundle.get('/api/diagnostic');
  assert.equal(response.home, '');
  assert.deepEqual(response.log, []);
  assert.equal(response.node, process.version);
  assert.equal(response.platform, process.platform);
  assert.ok(response.database.endsWith('startica.db'));
  assert.ok(response.backupDirectory.length > 0);
  assert.equal(typeof response.schemaVersion, 'number');
  assert.equal(response.health.ok, true);
  assert.deepEqual(response.backups, []);
});

test('GET /api/diagnostic citește ultimele 200 de linii din jurnal și ultimele backupuri', async t => {
  const home = mkdtempSync(join(tmpdir(), 'startica-diagnostic-home-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  mkdirSync(join(home, 'Jurnale'), { recursive: true });
  const logFile = join(home, 'Jurnale', 'startica.log');
  const lines = Array.from({ length: 205 }, (_, i) => `linia ${i}`);
  writeFileSync(logFile, lines.join('\n') + '\n');
  const bundle = await startTestApplication(t, { prefix: 'startica-diagnostic-', allowShutdown: true, home, logFile });
  await bundle.post('/api/backup', {});
  const response = await bundle.get('/api/diagnostic');
  assert.equal(response.home, home);
  assert.equal(response.log.length, 200);
  assert.equal(response.log[0], 'linia 5');
  assert.equal(response.log.at(-1), 'linia 204');
  assert.ok(response.backups.length >= 1 && response.backups.length <= 10);
  assert.ok(response.backups.every(name => typeof name === 'string'));
});

test('raportul de diagnostic nu conține date personale', async t => {
  const home = mkdtempSync(join(tmpdir(), 'startica-diagnostic-home-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  mkdirSync(join(home, 'Jurnale'), { recursive: true });
  const logFile = join(home, 'Jurnale', 'startica.log');
  writeFileSync(
    logFile,
    '2026-09-15T08:00:00.000Z ERROR Eroare după trimiterea răspunsului: Copilul asociat nu există.\n' +
      '    at Object.handle (C:\\Users\\PCC\\Aplicatie_Startica\\src\\features\\children\\server\\children.routes.mjs:42:11)\n',
  );
  const bundle = await startTestApplication(t, { prefix: 'startica-diagnostic-', allowShutdown: true, home, logFile });
  const childName = 'Zorro Testescu';
  const parentName = 'Ramona Testescu';
  const phone = '+37369999123';
  const paymentNote = 'Nota-unica-plata-9f3c1a';
  const child = normalizeRecord('children', {
    id: 'ID-diagnostic-test',
    name: childName,
    parent: parentName,
    phone,
    status: 'Activ',
    attendanceDate: '2026-09-01',
    fee: 2000,
    dueDay: 10,
    feeHistory: [{ from: '2026-09', amount: 2000 }],
  });
  let response = await bundle.post('/api/record', {
    record: child,
    type: 'children',
    revision: 0,
    mode: 'create',
    requestId: randomUUID(),
  });
  assert.equal(response.status, 200);
  const payment = normalizeRecord('payments', {
    id: 'PAY-diagnostic-test',
    childId: child.id,
    date: '2026-09-08',
    amount: 2000,
    method: 'Cash',
    notes: paymentNote,
    allocations: [{ month: '2026-09', amount: 2000 }],
  });
  response = await bundle.post('/api/record', {
    record: payment,
    type: 'payments',
    revision: 1,
    mode: 'create',
    requestId: randomUUID(),
  });
  assert.equal(response.status, 200);
  const diagnostic = await bundle.get('/api/diagnostic');
  assert.ok(diagnostic.log.length >= 2);
  const serialized = JSON.stringify(diagnostic);
  for (const secret of [childName, parentName, phone, paymentNote])
    assert.ok(!serialized.includes(secret), `diagnosticul conține „${secret}”`);
});
