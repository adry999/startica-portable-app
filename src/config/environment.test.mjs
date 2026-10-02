import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { DEFAULT_AUTO_BACKUP_INTERVAL_MS, DEFAULT_RELEASE_REPO, loadEnvironment, dataLayout } from './environment.mjs';

test('fără variabile, profilul este development și deschide browserul', () => {
  assert.deepEqual(loadEnvironment({}), {
    profile: 'development',
    port: 8765,
    openBrowser: true,
    autoBackupIntervalMs: DEFAULT_AUTO_BACKUP_INTERVAL_MS,
    home: undefined,
    releaseRepo: DEFAULT_RELEASE_REPO,
    autoDownloadUpdate: true,
  });
});

test('lansatorul desktop primește production, portul ales și fără browser separat', () => {
  const environment = loadEnvironment({
    STARTICA_PROFILE: 'production',
    STARTICA_PORT: '8791',
    STARTICA_NO_BROWSER: '1',
  });

  assert.deepEqual(environment, {
    profile: 'production',
    port: 8791,
    openBrowser: false,
    autoBackupIntervalMs: DEFAULT_AUTO_BACKUP_INTERVAL_MS,
    home: undefined,
    releaseRepo: DEFAULT_RELEASE_REPO,
    autoDownloadUpdate: true,
  });
  assert.equal(Object.isFrozen(environment), true);
});

test('profilul test alege un port liber, face backup la fiecare scriere și nu descarcă actualizări singur', () => {
  assert.deepEqual(loadEnvironment({ STARTICA_PROFILE: 'test' }), {
    profile: 'test',
    port: 0,
    openBrowser: false,
    autoBackupIntervalMs: 0,
    home: undefined,
    releaseRepo: DEFAULT_RELEASE_REPO,
    autoDownloadUpdate: false,
  });
});

// PROMPT-11 §4.3: implicit automată, dar STARTICA_UPDATE_AUTO_DOWNLOAD=0 o oprește explicit
// (test:e2e), indiferent de profil.
test('STARTICA_UPDATE_AUTO_DOWNLOAD=0 oprește descărcarea automată, chiar și în development', () => {
  assert.equal(loadEnvironment({}).autoDownloadUpdate, true);
  assert.equal(loadEnvironment({ STARTICA_UPDATE_AUTO_DOWNLOAD: '0' }).autoDownloadUpdate, false);
  assert.equal(loadEnvironment({ STARTICA_PROFILE: 'test' }).autoDownloadUpdate, false);
  assert.equal(
    loadEnvironment({ STARTICA_PROFILE: 'production', STARTICA_UPDATE_AUTO_DOWNLOAD: '0' }).autoDownloadUpdate,
    false,
  );
});

test('STARTICA_RELEASE_REPO suprascrie repo-ul implicit de release-uri (§5.2)', () => {
  assert.equal(loadEnvironment({}).releaseRepo, DEFAULT_RELEASE_REPO);
  assert.equal(
    loadEnvironment({ STARTICA_RELEASE_REPO: 'adry999/startica-releases' }).releaseRepo,
    'adry999/startica-releases',
  );
});

test('STARTICA_PORT=0 lasă sistemul să aleagă portul', () => {
  assert.equal(loadEnvironment({ STARTICA_PORT: '0' }).port, 0);
});

test('STARTICA_HOME absent păstrează comportamentul de azi, cu datele în folderul aplicației', () => {
  assert.equal(loadEnvironment({}).home, undefined);
});

test('STARTICA_HOME cu o cale absolută este acceptată', () => {
  const home = process.platform === 'win32' ? 'C:\\Users\\test\\AppData\\Local\\Startica' : '/home/test/.startica';
  assert.equal(loadEnvironment({ STARTICA_HOME: home }).home, home);
});

test('STARTICA_HOME relativ sau gol oprește pornirea', () => {
  for (const home of ['', 'Startica', '.\\Startica', '../Startica'])
    assert.throws(() => loadEnvironment({ STARTICA_HOME: home }), /STARTICA_HOME invalid/, home);
});

test('STARTICA_NO_BROWSER oprește browserul doar cu valoarea 1', () => {
  assert.equal(loadEnvironment({ STARTICA_NO_BROWSER: '0' }).openBrowser, true);
  assert.equal(loadEnvironment({ STARTICA_NO_BROWSER: '1' }).openBrowser, false);
});

test('dataLayout construiește cele trei foldere sub rădăcina de date', () => {
  const home = process.platform === 'win32' ? 'C:\\Startica' : '/home/test/.startica';
  assert.deepEqual(dataLayout(home), {
    dataDir: join(home, 'Startica_Date'),
    backupDir: join(home, 'Startica_Backup'),
    logDir: join(home, 'Jurnale'),
  });
});

test('refuză un profil sau un port invalid', () => {
  assert.throws(() => loadEnvironment({ STARTICA_PROFILE: 'staging' }), /STARTICA_PROFILE necunoscut/);
  for (const port of ['', 'abc', '-1', '8765.5', '65536', '123456', ' 8765'])
    assert.throws(() => loadEnvironment({ STARTICA_PORT: port }), /STARTICA_PORT invalid/, port);
});
