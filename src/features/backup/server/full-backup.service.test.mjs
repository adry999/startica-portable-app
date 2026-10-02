import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '#core/server/database/sqlite-connection.mjs';
import { readZipArchive, createZipArchive } from '#core/server/files/zip-archive.mjs';
import { createFullBackupService, ARCHIVE_EXTENSION } from './full-backup.service.mjs';

/** @param {import('node:test').TestContext} t */
function createHarness(t) {
  const home = mkdtempSync(join(tmpdir(), 'startica-full-backup-'));

  const legacy = { dataDir: join(home, 'Startica_Date'), backupDir: join(home, 'Startica_Backup') };
  const { db: activeDb, dbFile: activeDbFile } = openDatabase(legacy);
  t.after(() => activeDb.close());
  activeDb.prepare('INSERT INTO records (kind, id, payload) VALUES (?, ?, ?)').run('children', 'c1', '{}');

  const commonLayout = {
    dataDir: join(home, 'Comun', 'Startica_Date'),
    backupDir: join(home, 'Comun', 'Startica_Backup'),
  };
  const { db: commonDb } = openDatabase(commonLayout);
  t.after(() => commonDb.close());
  commonDb.prepare('INSERT INTO records (kind, id, payload) VALUES (?, ?, ?)').run('staff', 'STF-1', '{}');

  // Filială neactivă: bază creată (folder + fișier), dar fără conexiune deschisă acum —
  // exact situația unei filiale pe care nimeni n-a vizitat-o de la pornirea serverului.
  const otherLayout = {
    dataDir: join(home, 'Filiale', 'botanica', 'Startica_Date'),
    backupDir: join(home, 'Filiale', 'botanica', 'Startica_Backup'),
  };
  const { db: otherDb } = openDatabase(otherLayout);
  otherDb.prepare('INSERT INTO records (kind, id, payload) VALUES (?, ?, ?)').run('children', 'c2', '{}');
  otherDb.close();

  // Filială "goală": în registru, dar fără nicio bază creată pe disc (creată chiar acum,
  // niciodată deschisă) — trebuie omisă din arhivă, nu să arunce.
  const emptyBranch = {
    id: 'br-empty',
    name: 'Filiala goală',
    color: 'orange',
    address: '',
    createdAt: '',
    folder: 'goala',
  };

  const activeBranch = {
    id: 'br-active',
    name: 'Filiala principală',
    color: 'orange',
    address: '',
    createdAt: '',
    folder: null,
  };
  const otherBranch = {
    id: 'br-other',
    name: 'Botanica',
    color: 'mint',
    address: '',
    createdAt: '',
    folder: 'botanica',
  };
  const registry = { list: () => [activeBranch, otherBranch, emptyBranch] };

  const backupDirectory = legacy.backupDir;
  mkdirSync(backupDirectory, { recursive: true });
  /** @type {Map<string, string>} */
  const settings = new Map();
  // Înregistrat ultimul — hook-urile `t.after` rulează în ordinea adăugării (Windows nu
  // poate șterge un fișier .db cât timp o conexiune SQLite îl mai ține deschis).
  t.after(() => rmSync(home, { recursive: true, force: true }));

  const service = createFullBackupService({
    registry,
    home,
    legacy,
    activeBranch: () => ({ branch: activeBranch, db: activeDb }),
    common: () => ({ db: commonDb }),
    backupDirectory: () => backupDirectory,
    readSetting: key => settings.get(key) ?? '',
    writeSetting: (key, value) => void settings.set(key, value),
    appVersion: '2.1.0',
  });

  return { home, service, backupDirectory, activeDbFile, settings };
}

test('backup() produce o arhivă cu common + toate filialele cu bază creată, omițând filiala goală', t => {
  const { service, backupDirectory } = createHarness(t);

  const result = service.backup('manual');

  assert.ok(existsSync(result.file));
  assert.equal(result.warning, '');
  assert.equal(result.manifest.databases.length, 3); // common + br-active + br-other, nu br-empty

  const ids = result.manifest.databases.map(d => d.id).sort();
  assert.deepEqual(ids, ['br-active', 'br-other', 'common']);

  const common = result.manifest.databases.find(d => d.id === 'common');
  assert.ok(common);
  assert.equal(common.kind, 'common');
  assert.equal(common.counts.staff, 1);

  const active = result.manifest.databases.find(d => d.id === 'br-active');
  assert.ok(active);
  assert.equal(active.kind, 'branch');
  assert.equal(active.counts.children, 1);

  const other = result.manifest.databases.find(d => d.id === 'br-other');
  assert.ok(other);
  assert.equal(other.counts.children, 1);

  assert.ok(result.name.endsWith(ARCHIVE_EXTENSION));

  // Fișierul listat de serviciu e exact cel scris.
  const listed = service.listBackups();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].name, result.name);
});

test('filiala neactivă nu rămâne cu nicio conexiune deschisă după backup', t => {
  const { service, home } = createHarness(t);
  service.backup('manual');

  // Dacă backup() ar fi lăsat o conexiune deschisă pe baza filialei „botanica”, redeschiderea
  // ei aici (alt handle SQLite pe același fișier, fără busy_timeout) ar eșua sau ar bloca.
  const otherFile = join(home, 'Filiale', 'botanica', 'Startica_Date', 'startica.db');
  const reopened = new DatabaseSync(otherFile, { readOnly: true });
  try {
    const row = /** @type {{ n: number }} */ (reopened.prepare('SELECT COUNT(*) AS n FROM records').get());
    assert.equal(row.n, 1);
  } finally {
    reopened.close();
  }
});

test('readArchiveManifest() citește manifestul fără să scrie nimic', t => {
  const { service } = createHarness(t);
  const { file, manifest } = service.backup('manual');

  const read = service.readArchiveManifest(file);
  assert.deepEqual(read, manifest);
});

test('isArchive() distinge o arhivă de un fișier .db obișnuit', t => {
  const { service, activeDbFile } = createHarness(t);
  const { file } = service.backup('manual');

  assert.equal(service.isArchive(file), true);
  assert.equal(service.isArchive(activeDbFile), false);
});

test('resolveArchiveFile() refuză nume care nu sunt arhive sau care sunt căi', t => {
  const { service } = createHarness(t);
  service.backup('manual');

  assert.throws(() => service.resolveArchiveFile('../ceva.startica-backup'));
  assert.throws(() => service.resolveArchiveFile('ceva.db'));
  assert.throws(() => service.resolveArchiveFile('inexistent_123.startica-backup'));
});

test('ambele apeluri backup() produc arhive distincte, fără coliziune de nume', t => {
  const { service } = createHarness(t);
  const first = service.backup('manual');
  const second = service.backup('manual');

  assert.notEqual(first.name, second.name);
  assert.equal(service.listBackups().length, 2);
});

test('manifestul include appVersion și activeBranchId (42d)', t => {
  const { service } = createHarness(t);
  const { manifest } = service.backup('manual');

  assert.equal(manifest.appVersion, '2.1.0');
  assert.equal(manifest.activeBranchId, 'br-active');
});

test('validateArchive() acceptă o arhivă validă și întoarce conținutul fiecărei baze', t => {
  const { service } = createHarness(t);
  const { file, manifest } = service.backup('manual');

  const { manifest: validated, databaseFiles } = service.validateArchive(file);

  assert.deepEqual(validated, manifest);
  assert.equal(databaseFiles.size, 3);
  for (const entry of manifest.databases) assert.ok(databaseFiles.get(entry.id) instanceof Buffer);
});

test('validateArchive() nu lasă niciun folder de lucru în urmă, nici la succes nici la eșec', t => {
  const { service, backupDirectory } = createHarness(t);
  const { file } = service.backup('manual');

  service.validateArchive(file);
  assert.deepEqual(
    readdirSync(backupDirectory).filter(name => name.startsWith('.restaurare-')),
    [],
  );
});

test('restore() respinge o arhivă creată cu o versiune de Startica mai nouă (42d: blocat)', t => {
  const { service } = createHarness(t);
  const { file } = service.backup('manual');

  const newer = createFullBackupService({
    registry: { list: () => [] },
    home: '',
    legacy: { dataDir: '', backupDir: '' },
    activeBranch: () => ({ branch: { id: 'x' }, db: null }),
    common: () => ({ db: null }),
    backupDirectory: () => dirname(file),
    readSetting: () => '',
    writeSetting: () => {},
    appVersion: '2.0.0',
  });

  assert.throws(
    () => newer.restore(file, { apply: () => assert.fail('apply nu trebuia chemat') }),
    /mai nouă decât versiunea instalată/,
  );
});

test('restore() respinge o arhivă căreia îi lipsește o bază declarată în manifest', t => {
  const { service } = createHarness(t);
  const { file, manifest } = service.backup('manual');

  const entries = readZipArchive(readFileSync(file)).filter(entry => entry.name !== 'branch-br-other.db');
  const truncated = file + '.truncat';
  writeFileSync(truncated, createZipArchive(entries));

  assert.throws(() => service.restore(truncated, { apply: () => {} }), /nu conține branch-br-other\.db/);
  assert.equal(manifest.databases.some(entry => entry.file === 'branch-br-other.db'), true);
});

test('restore() respinge o arhivă a cărei numărătoare nu corespunde manifestului (coruptă/alterată)', t => {
  const { service } = createHarness(t);
  const { file } = service.backup('manual');

  const entries = readZipArchive(readFileSync(file));
  const manifestEntry = entries.find(entry => entry.name === 'manifest.json');
  const manifest = JSON.parse(manifestEntry.data.toString('utf8'));
  manifest.databases.find(entry => entry.id === 'br-active').counts.children = 99;
  manifestEntry.data = Buffer.from(JSON.stringify(manifest));
  const altered = file + '.alterat';
  writeFileSync(altered, createZipArchive(entries));

  assert.throws(() => service.restore(altered, { apply: () => {} }), /numărătoarea bazei.*nu corespunde/i);
});

test('restore() cheamă apply() cu manifestul și conținutul fiecărei baze, după validare completă', t => {
  const { service } = createHarness(t);
  const { file, manifest } = service.backup('manual');

  let received = null;
  service.restore(file, {
    apply: args => {
      received = args;
    },
  });

  assert.deepEqual(received.manifest, manifest);
  assert.equal(received.databaseFiles.size, 3);
});
