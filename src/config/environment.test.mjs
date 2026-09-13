import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_AUTO_BACKUP_INTERVAL_MS, loadEnvironment } from './environment.mjs';

test('fără variabile, profilul este development și deschide browserul', () => {
  assert.deepEqual(loadEnvironment({}), {
    profile: 'development',
    port: 8765,
    openBrowser: true,
    autoBackupIntervalMs: DEFAULT_AUTO_BACKUP_INTERVAL_MS,
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
  });
  assert.equal(Object.isFrozen(environment), true);
});

test('profilul test alege un port liber și face backup la fiecare scriere', () => {
  assert.deepEqual(loadEnvironment({ STARTICA_PROFILE: 'test' }), {
    profile: 'test',
    port: 0,
    openBrowser: false,
    autoBackupIntervalMs: 0,
  });
});

test('STARTICA_NO_BROWSER oprește browserul doar cu valoarea 1', () => {
  assert.equal(loadEnvironment({ STARTICA_NO_BROWSER: '0' }).openBrowser, true);
  assert.equal(loadEnvironment({ STARTICA_NO_BROWSER: '1' }).openBrowser, false);
});

test('refuză un profil sau un port invalid', () => {
  assert.throws(() => loadEnvironment({ STARTICA_PROFILE: 'staging' }), /STARTICA_PROFILE necunoscut/);
  for (const port of ['', 'abc', '-1', '8765.5', '65536', '123456', ' 8765'])
    assert.throws(() => loadEnvironment({ STARTICA_PORT: port }), /STARTICA_PORT invalid/, port);
});
