import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createUpdateDownloadService, UPDATE_PENDING_VERSION_SETTING } from './update-download.service.mjs';

/** @param {string} text */
function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

/** @param {string} body @param {{ status?: number, ok?: boolean }} [options] */
function fakeResponse(body, { status = 200, ok = status >= 200 && status < 300 } = {}) {
  const encoder = new TextEncoder();
  return {
    ok,
    status,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    }),
  };
}

/** @param {import('node:test').TestContext} t @param {{ fetch?: (...args: any[]) => Promise<any> }} [options] */
function createHarness(t, { fetch } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'startica-update-download-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  /** @type {Map<string, string>} */
  const settings = new Map();
  const readSetting = key => settings.get(key) ?? '';
  const writeSetting = (key, value) => void settings.set(key, value);
  const service = createUpdateDownloadService({
    home,
    fetch: /** @type {any} */ (fetch ?? (async () => fakeResponse('conținut-instaler'))),
    readSetting,
    writeSetting,
  });
  return { home, service, settings, readSetting, writeSetting };
}

test('downloadAndVerify: succes — fișier scris în <home>\\Actualizari, settings actualizate', async t => {
  const content = 'conținut-instaler-valid';
  const { service, home, readSetting } = createHarness(t, { fetch: async () => fakeResponse(content) });

  const result = await service.downloadAndVerify({
    downloadUrl: 'https://exemplu.md/releases/download/v2.2.0/Startica_Setup_2.2.0.exe',
    sha256: sha256(content),
    version: '2.2.0',
  });

  assert.equal(result.ok, true);
  assert.ok(/** @type {any} */ (result).file.startsWith(join(home, 'Actualizari')));
  assert.equal(readFileSync(/** @type {any} */ (result).file, 'utf8'), content);
  assert.equal(readSetting(UPDATE_PENDING_VERSION_SETTING), '2.2.0');
  assert.deepEqual(service.pendingUpdate(), { version: '2.2.0', file: /** @type {any} */ (result).file });
});

test('downloadAndVerify: SHA-256 nepotrivit — fișierul e șters, nimic nu devine "gata de instalat"', async t => {
  const { service } = createHarness(t, { fetch: async () => fakeResponse('conținut-adevărat') });

  const result = await service.downloadAndVerify({
    downloadUrl: 'https://exemplu.md/releases/download/v2.2.0/Startica_Setup_2.2.0.exe',
    sha256: sha256('altceva-complet-diferit'),
    version: '2.2.0',
  });

  assert.equal(result.ok, false);
  assert.match(/** @type {any} */ (result).error, /SHA-256/);
  assert.equal(service.pendingUpdate(), null);
});

test('downloadAndVerify: lipsa downloadUrl/sha256 eșuează fără nicio cerere de rețea', async t => {
  let called = false;
  const { service } = createHarness(t, {
    fetch: async () => {
      called = true;
      return fakeResponse('x');
    },
  });

  const result = await service.downloadAndVerify({ downloadUrl: null, sha256: null, version: '2.2.0' });

  assert.equal(result.ok, false);
  assert.equal(called, false);
});

test('downloadAndVerify: un răspuns HTTP de eroare nu lasă niciun instaler pe disc', async t => {
  const { service, home } = createHarness(t, { fetch: async () => fakeResponse('', { status: 404 }) });

  const result = await service.downloadAndVerify({
    downloadUrl: 'https://exemplu.md/releases/download/v2.2.0/Startica_Setup_2.2.0.exe',
    sha256: sha256('orice'),
    version: '2.2.0',
  });

  assert.equal(result.ok, false);
  assert.equal(existsSync(join(home, 'Actualizari', 'Startica_Setup_2.2.0.exe')), false);
  assert.equal(service.pendingUpdate(), null);
});

test('downloadAndVerify: o eroare de rețea (fetch aruncă) nu aruncă mai departe', async t => {
  const { service } = createHarness(t, {
    fetch: async () => {
      throw new Error('ECONNREFUSED');
    },
  });

  const result = await service.downloadAndVerify({
    downloadUrl: 'https://exemplu.md/releases/download/v2.2.0/Startica_Setup_2.2.0.exe',
    sha256: sha256('orice'),
    version: '2.2.0',
  });

  assert.equal(result.ok, false);
  assert.match(/** @type {any} */ (result).error, /ECONNREFUSED/);
});

test('pendingUpdate întoarce null dacă fișierul a dispărut de pe disc între timp', async t => {
  const content = 'conținut';
  const { service } = createHarness(t, { fetch: async () => fakeResponse(content) });
  const result = await service.downloadAndVerify({
    downloadUrl: 'https://exemplu.md/releases/download/v2.2.0/Startica_Setup_2.2.0.exe',
    sha256: sha256(content),
    version: '2.2.0',
  });
  assert.equal(result.ok, true);
  rmSync(/** @type {any} */ (result).file);

  assert.equal(service.pendingUpdate(), null);
});

test('clearPending golește settings — pendingUpdate întoarce null după', async t => {
  const content = 'conținut';
  const { service } = createHarness(t, { fetch: async () => fakeResponse(content) });
  await service.downloadAndVerify({
    downloadUrl: 'https://exemplu.md/releases/download/v2.2.0/Startica_Setup_2.2.0.exe',
    sha256: sha256(content),
    version: '2.2.0',
  });
  assert.ok(service.pendingUpdate());

  service.clearPending();

  assert.equal(service.pendingUpdate(), null);
});
