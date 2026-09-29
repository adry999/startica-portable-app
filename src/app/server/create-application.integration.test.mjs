import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  renameSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { normalizeRecord, emptyState } from '#shared/domain/record-schema.mjs';
import { writeSyncDeviceFile } from '#features/sync/index.server.mjs';
import { createApplication, startTestApplication, removeDirWithRetry } from '#test-support/start-test-application.mjs';
import { applySchema } from '#core/server/database/schema.mjs';
import { writeSettingValue } from '#core/server/settings/settings-repository.mjs';

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
  let response = await post('/api/record', request(child(), 'children', 0));
  assert.equal(response.status, 200);
  assert.equal(response.body.revision, 1);
  const pay = request(payment(), 'payments', 1);
  response = await post('/api/record', pay);
  assert.equal(response.status, 200);
  response = await post('/api/record', pay);
  assert.equal(response.body.replayed, true);
  assert.equal(response.body.state.payments.length, 1);
  response = await post(
    '/api/record',
    request(normalizeRecord('expenses', { id: 'EXP-test', date: '2026-09-08', amount: 100 }), 'expenses', 1),
  );
  assert.equal(response.status, 409);
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
  response = await post('/api/record', request({ ...child(), phone: '123' }, 'children', 4, 'update'));
  assert.equal(response.status, 200);
  assert.match(response.body.warning, /extern/);
  renameSync(backupDir, backupDir + '-offline');
  response = await post('/api/record', request({ ...child(), phone: '456' }, 'children', 5, 'update'));
  assert.equal(response.status, 200);
  assert.match(response.body.warning, /backupul local/);
  assert.equal(response.body.state.children[0].phone, '456');
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
  const invalid = { children: [child(), child()], payments: [], expenses: [], groups: [], categories: [], visits: [] };
  assert.equal(
    (await post('/api/import', { state: invalid, confirm: 'IMPORT', revision: 6, requestId: randomUUID() })).status,
    400,
  );
  assert.equal((await get('/api/state')).state.children[0].phone, '456');
  const importRequest = {
    state: { children: [child()], payments: [payment()], expenses: [], groups: [], categories: [], visits: [] },
    confirm: 'IMPORT',
    revision: 6,
    requestId: randomUUID(),
  };
  response = await post('/api/import', importRequest);
  assert.equal(response.status, 200);
  assert.equal(response.body.revision, 7);
  response = await post('/api/import', importRequest);
  assert.equal(response.body.replayed, true);
  assert.equal(response.body.state.payments.length, 1);
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
  const state = { children: [child()], payments: [payment()], expenses: [], groups: [], categories: [] };
  old.prepare('INSERT INTO app_state VALUES(1,?)').run(JSON.stringify(state));
  old.close();
  const app = createApplication({ dataDir: join(dir, 'data'), backupDir: join(dir, 'backups'), home: dir });
  const migrated = app.envelope().state;
  // Categoriile de cheltuieli implicite (cu „General”) se creează la prima deschidere a bazei migrate.
  assert.deepEqual({ ...migrated, categories: [] }, { ...state, visits: [], charges: [], payerAliases: [] });
  assert.ok(migrated.categories.some(category => category.id === 'CAT-general' && category.name === 'General'));
  assert.ok(readdirSync(join(dir, 'backups')).some(f => f.includes('migrare')));
  app.closeSync();
  if (
    resolve(dir).startsWith(resolve(tmpdir()) + '\\startica-migration-') ||
    resolve(dir).startsWith(resolve(tmpdir()) + '/startica-migration-')
  )
    rmSync(dir, { recursive: true, force: true });
});

test('Migrarea 003 transformă notes text al unui copil într-o listă de note (CF-4)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'startica-migration-notes-'));
  mkdirSync(join(dir, 'data'));
  const db = new DatabaseSync(join(dir, 'data/startica.db'));
  applySchema(db);
  writeSettingValue(db, 'schemaVersion', '2');
  db.prepare('INSERT INTO records VALUES(?,?,?)').run(
    'children',
    'C1',
    JSON.stringify({ ...child(), notes: '  observație veche  ' }),
  );
  db.close();

  const app = createApplication({ dataDir: join(dir, 'data'), backupDir: join(dir, 'backups'), home: dir });
  const [migratedChild] = app.envelope().state.children;
  assert.equal(migratedChild.notes.length, 1);
  assert.equal(migratedChild.notes[0].text, 'observație veche');
  assert.ok(migratedChild.notes[0].date);
  assert.ok(readdirSync(join(dir, 'backups')).some(f => f.includes('migrare')));
  app.closeSync();
  if (
    resolve(dir).startsWith(resolve(tmpdir()) + '\\startica-migration-notes-') ||
    resolve(dir).startsWith(resolve(tmpdir()) + '/startica-migration-notes-')
  )
    rmSync(dir, { recursive: true, force: true });
});

test('Prima pornire creează filiale.json cu filiala principală pe folderele vechi și nu mută nimic', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'startica-branch-first-run-'));
  const dataDir = join(dir, 'data');
  const backupDir = join(dir, 'backups');
  const registryFile = join(dir, 'filiale.json');
  try {
    const first = createApplication({ dataDir, backupDir, home: dir, autoBackupIntervalMs: 0 });
    await new Promise(done => first.server.listen(0, '127.0.0.1', done));
    const origin = `http://127.0.0.1:${/** @type {import('node:net').AddressInfo} */ (first.server.address()).port}`;
    const { token } = await (await fetch(origin + '/api/session')).json();
    const importRequest = {
      state: { children: [child()], payments: [payment()], expenses: [], groups: [], categories: [], visits: [] },
      confirm: 'IMPORT',
      revision: 0,
      requestId: randomUUID(),
    };
    const imported = await fetch(origin + '/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Startica-Token': token },
      body: JSON.stringify(importRequest),
    });
    assert.equal(imported.status, 200);
    const revisionAfterImport = (await imported.json()).revision;
    await first.close();

    assert.ok(existsSync(registryFile), 'filiale.json nu a fost creat la prima pornire');
    const registryAfterFirstRun = JSON.parse(readFileSync(registryFile, 'utf8'));
    assert.equal(registryAfterFirstRun.branches.length, 1);
    assert.equal(registryAfterFirstRun.branches[0].folder, null, 'filiala migrată nu are voie să mute datele');
    assert.equal(registryAfterFirstRun.lastBranchId, registryAfterFirstRun.branches[0].id);
    assert.ok(existsSync(join(dataDir, 'startica.db')), 'datele vechi trebuie să rămână pe loc, nu mutate');
    assert.ok(!existsSync(join(dir, 'Filiale')), 'o instalare cu o singură filială nu are voie să creeze Filiale\\');

    const second = createApplication({ dataDir, backupDir, home: dir, autoBackupIntervalMs: 0 });
    assert.equal(second.envelope().revision, revisionAfterImport, 'restart-ul trebuie să vadă exact aceleași date');
    second.closeSync();
    const registryAfterRestart = JSON.parse(readFileSync(registryFile, 'utf8'));
    assert.deepEqual(registryAfterRestart, registryAfterFirstRun, 'o a doua pornire nu rescrie registrul existent');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('importul unui instantaneu identic (calculator sincronizat) nu pune nimic în outbox, doar diferențele reale', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'startica-import-outbox-'));
  try {
    writeSyncDeviceFile(join(dir, 'sync.json'), {
      serverUrl: 'https://exemplu.invalid',
      deviceId: 'DEV-1',
      deviceName: 'Calculator test',
      token: 'tok',
      connectedAt: '2026-09-28T00:00:00.000Z',
    });
    const app = createApplication({
      dataDir: join(dir, 'data'),
      backupDir: join(dir, 'backups'),
      home: dir,
      autoBackupIntervalMs: 0,
    });
    await new Promise(done => app.server.listen(0, '127.0.0.1', done));
    const url = `http://127.0.0.1:${app.server.address().port}`;
    const token = (await (await fetch(url + '/api/session')).json()).token;
    const post = async (path, body) => {
      const response = await fetch(url + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Startica-Token': token },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    };
    // enqueue() coalesează pe (kind,record_id) cât timp rândul e încă „pending” (aceeași
    // modificare retrimisă nu adaugă un rând nou) — deci un simplu COUNT(*) nu ar
    // deosebi „nimic nou” de „totul reintrodus”. Marcăm rândurile ca „sent” între
    // pași (ca după un push reușit), ca appearance rândurilor noi să fie vizibilă:
    // câte rânduri PENDING apar după fiecare import, plecând mereu de la zero.
    const markAllSent = () => app.db.exec("UPDATE sync_outbox SET status='sent' WHERE status='pending'");
    const pendingCount = () => app.db.prepare("SELECT COUNT(*) AS n FROM sync_outbox WHERE status='pending'").get().n;

    const initial = await fetch(url + '/api/state').then(r => r.json());
    markAllSent();

    const firstImport = await post('/api/import', {
      state: { ...initial.state, children: [child()] },
      confirm: 'IMPORT',
      revision: initial.revision,
      requestId: randomUUID(),
    });
    assert.equal(firstImport.status, 200, firstImport.body.error);
    assert.ok(
      pendingCount() > 0,
      'primul import (o filială nouă, deja diferită) trebuie să lase urme pending în outbox',
    );

    const currentState = firstImport.body.state;
    markAllSent();
    const identicalImport = await post('/api/import', {
      state: currentState,
      confirm: 'IMPORT',
      revision: firstImport.body.revision,
      requestId: randomUUID(),
    });
    assert.equal(identicalImport.status, 200, identicalImport.body.error);
    assert.equal(pendingCount(), 0, 'un instantaneu identic nu are voie să reintroducă toată evidența în outbox');

    const changedState = {
      ...currentState,
      children: currentState.children.map(record => ({ ...record, phone: '999' })),
    };
    markAllSent();
    const differingImport = await post('/api/import', {
      state: changedState,
      confirm: 'IMPORT',
      revision: identicalImport.body.revision,
      requestId: randomUUID(),
    });
    assert.equal(differingImport.status, 200, differingImport.body.error);
    assert.equal(
      pendingCount(),
      1,
      'o singură înregistrare cu adevărat schimbată trebuie să lase o singură intrare nouă în outbox',
    );

    await app.close();
  } finally {
    await removeDirWithRetry(dir);
  }
});

test('Un registru cu branches: [] oprește pornirea cu mesaj, fără TypeError', () => {
  const dir = mkdtempSync(join(tmpdir(), 'startica-branch-empty-'));
  try {
    writeFileSync(join(dir, 'filiale.json'), JSON.stringify({ version: 1, lastBranchId: '', branches: [] }));
    assert.throws(
      () => createApplication({ dataDir: join(dir, 'data'), backupDir: join(dir, 'backups'), home: dir }),
      /Registrul filialelor \(filiale\.json\) este corupt/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Un registru corupt oprește pornirea cu mesaj', () => {
  const dir = mkdtempSync(join(tmpdir(), 'startica-branch-corrupt-'));
  try {
    writeFileSync(join(dir, 'filiale.json'), '{ nu e json');
    assert.throws(
      () => createApplication({ dataDir: join(dir, 'data'), backupDir: join(dir, 'backups'), home: dir }),
      /Registrul filialelor \(filiale\.json\) este corupt/,
    );
    assert.ok(
      !existsSync(join(dir, 'data', 'startica.db')),
      'niciun fișier nu are voie să fie creat înainte de eroare',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
