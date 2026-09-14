import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApplication, startTestApplication } from '#test-support/start-test-application.mjs';

const temporary = prefix => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  return {
    dir,
    remove() {
      if (resolve(dir).startsWith(resolve(tmpdir()))) rmSync(dir, { recursive: true, force: true });
    },
  };
};

// Helper pentru testele care vorbesc cu serverul prin HTTP.
async function startApplication(t, prefix, options = {}) {
  const { dir, get, postJson } = await startTestApplication(t, { prefix, ...options });
  return { dir, backupDir: join(dir, 'backups'), get, post: postJson };
}
const CHILD = { id: 'ID-1', name: 'Copil', dueDay: 10, status: 'Activ' };

test('Backupul curăță fișierele .tmp rămase de la o întrerupere', async t => {
  const { dir, remove } = temporary('startica-tmp-');
  const backupDir = join(dir, 'backups');
  const app = createApplication({ dataDir: join(dir, 'data'), backupDir });
  t.after(async () => {
    await app.close();
    remove();
  });

  const stale = join(backupDir, 'startica_2020-01-01_pornire_aaaaaaaa.db.tmp');
  const running = join(backupDir, 'startica_2026-01-01_pornire_bbbbbbbb.db.tmp');
  for (const file of [stale, running]) writeFileSync(file, 'continut partial');
  const old = new Date(Date.now() - 7200000);
  utimesSync(stale, old, old);

  app.backup('manual');
  const left = readdirSync(backupDir).filter(n => n.endsWith('.tmp'));
  assert.deepEqual(left, ['startica_2026-01-01_pornire_bbbbbbbb.db.tmp'], 'Doar .tmp-ul recent rămâne.');
});

test('Backupul automat este rărit; cel dinaintea unui import rămâne obligatoriu', async t => {
  const app = await startApplication(t, 'startica-debounce-', { autoBackupIntervalMs: 300000 });
  const automatic = () => readdirSync(app.backupDir).filter(n => n.includes('_automat_')).length;

  let revision = 0;
  for (let n = 0; n < 5; n++) {
    const result = await app.post('/api/record', {
      type: 'children',
      mode: n === 0 ? 'create' : 'update',
      record: { ...CHILD, phone: String(n) },
      revision,
      requestId: randomUUID(),
    });
    assert.equal(result.ok, true, result.error);
    revision = result.revision;
  }
  assert.equal(revision, 5, 'Toate cele cinci salvări sunt confirmate.');
  // Prima scriere copiază baza, fiindcă nu există încă nicio copie; următoarele
  // patru intră în interval. Înainte de debounce erau cinci copii.
  assert.equal(automatic(), 1, 'Numărul de backupuri automate nu crește cu numărul de salvări.');

  const imported = await app.post('/api/import', {
    state: { children: [CHILD], payments: [], expenses: [], groups: [], categories: [] },
    confirm: 'IMPORT',
    revision,
    requestId: randomUUID(),
  });
  assert.equal(imported.ok, true, imported.error);
  assert.ok(
    readdirSync(app.backupDir).some(n => n.includes('inainte-import')),
    'Copia dinaintea importului nu depinde de interval.',
  );
});

test('Backupul dinaintea ștergerii definitive apare în /api/backups, în permanentBackups și se poate previzualiza', async t => {
  const { post, get } = await startApplication(t, 'startica-stergere-');

  const created = await post('/api/record', {
    type: 'children',
    mode: 'create',
    record: { ...CHILD, archived: true },
    revision: 0,
    requestId: randomUUID(),
  });
  assert.equal(created.ok, true, created.error);

  const deleted = await post('/api/record-delete', {
    type: 'children',
    id: CHILD.id,
    revision: created.revision,
    requestId: randomUUID(),
  });
  assert.equal(deleted.ok, true, deleted.error);

  const backups = await get('/api/backups');
  const beforeDelete = backups.find(entry => entry.name.includes('inainte-stergere-definitiva'));
  assert.ok(beforeDelete, 'Backupul dinaintea ștergerii nu apare în listă.');

  const health = await get('/api/health');
  assert.equal(health.permanentBackups.count, 1);

  const preview = await get('/api/backup-preview?name=' + encodeURIComponent(beforeDelete.name));
  assert.deepEqual(preview.errors, []);
});

test('/api/health include externalBackups pentru folderul extern configurat', async t => {
  const app = await startApplication(t, 'startica-external-summary-');
  const external = join(app.dir, 'extern');
  mkdirSync(external);
  // /api/settings declanșează o copie ('configurare'), care e prima și singura din extern.
  assert.equal((await app.post('/api/settings', { externalDir: external })).ok, true);

  const health = await app.get('/api/health');

  assert.equal(health.externalBackups.count, 1);
  assert.ok(health.externalBackups.bytes > 0);
});

test('Dispariția folderului extern este raportată de starea aplicației, nu la următorul backup', async t => {
  const app = await startApplication(t, 'startica-extern-', { autoBackupIntervalMs: 300000 });
  const external = join(app.dir, 'extern');
  mkdirSync(external);
  const configured = await app.post('/api/settings', { externalDir: external });
  assert.equal(configured.ok, true, configured.error);
  assert.equal((await app.get('/api/health')).externalError, '', 'Cât timp folderul există, nu există eroare.');

  rmSync(external, { recursive: true, force: true });
  assert.match(
    (await app.get('/api/health')).externalError,
    /nu este disponibil/,
    'Problema este vizibilă imediat, fără să aștepte un backup.',
  );
});

test('Un backup eșuat se reîncearcă la următoarea salvare, fără să aștepte intervalul', async t => {
  const app = await startApplication(t, 'startica-retry-', { autoBackupIntervalMs: 300000 });
  const external = join(app.dir, 'extern');
  mkdirSync(external);
  assert.equal((await app.post('/api/settings', { externalDir: external })).ok, true);
  rmSync(external, { recursive: true, force: true });

  // Backupul manual nu este rărit: consemnează eroarea externă.
  const manual = await app.post('/api/backup', {});
  assert.match(manual.warning, /extern/);

  // Salvarea următoare este în interval, dar eroarea cunoscută forțează o
  // nouă încercare, ca utilizatorul să nu creadă că problema s-a rezolvat.
  const saved = await app.post('/api/record', {
    type: 'children',
    mode: 'create',
    record: CHILD,
    revision: 0,
    requestId: randomUUID(),
  });
  assert.equal(saved.ok, true, saved.error);
  assert.match(saved.warning, /extern/, 'Eroarea persistă pe răspunsul salvării.');
});

test('O modificare urmată de inactivitate primește totuși o copie, în afara cererii', async t => {
  const app = await startApplication(t, 'startica-amanat-', { autoBackupIntervalMs: 150 });
  const automatic = () => readdirSync(app.backupDir).filter(n => n.includes('_automat_')).length;

  const first = await app.post('/api/record', {
    type: 'children',
    mode: 'create',
    record: CHILD,
    revision: 0,
    requestId: randomUUID(),
  });
  assert.equal(first.ok, true, first.error);
  const second = await app.post('/api/record', {
    type: 'children',
    mode: 'update',
    record: { ...CHILD, phone: '123' },
    revision: first.revision,
    requestId: randomUUID(),
  });
  assert.equal(second.ok, true, second.error);
  const afterWrites = automatic();

  // Fără alte cereri: copia amânată trebuie să apară singură.
  await new Promise(r => setTimeout(r, 600));
  assert.ok(automatic() > afterWrites, `Copia amânată nu a fost creată (înainte ${afterWrites}, după ${automatic()}).`);
});
