import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { startTestApplication } from '#test-support/start-test-application.mjs';
import { releaseManifestUrl } from './update-check.service.mjs';

const REPO = 'adry999/startica-portable-app';
const DOWNLOAD_URL = 'https://exemplu.md/releases/download/v2.2.0/Startica_Setup_2.2.0.exe';
const INSTALLER_CONTENT = 'conținut-instaler-de-test';

/** @param {string} text */
function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

/** @param {string} url */
function fakeAppFetch(url) {
  if (String(url) === releaseManifestUrl(REPO))
    return Promise.resolve({
      ok: true,
      json: async () => ({
        version: '2.2.0',
        downloadUrl: DOWNLOAD_URL,
        sha256: sha256(INSTALLER_CONTENT),
        notes: 'Note de test',
      }),
    });
  if (String(url) === DOWNLOAD_URL) {
    const encoder = new TextEncoder();
    return Promise.resolve({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(INSTALLER_CONTENT));
          controller.close();
        },
      }),
    });
  }
  return Promise.reject(new Error(`URL neașteptat în test: ${url}`));
}

test('§8 PROMPT-10 Partea 2: check → download → verificare → pending → spawn la close()', async t => {
  /** @type {{ file: string, args: unknown[], options: unknown }[]} */
  const spawnCalls = [];
  const fakeSpawn = (file, args, options) => {
    spawnCalls.push({ file, args, options });
    return { unref: () => {} };
  };

  const { app, get, post } = await startTestApplication(t, {
    fetch: /** @type {any} */ (url => fakeAppFetch(String(url))),
    releaseRepo: REPO,
    spawnFn: /** @type {any} */ (fakeSpawn),
  });

  // Fără nicio verificare încă — nimic de descărcat.
  const refused = await post('/api/update/download', {});
  assert.equal(refused.status, 400);

  await app.checkForUpdate();
  const session1 = await get('/api/session');
  assert.equal(session1.update.updateAvailable, true);
  assert.equal(session1.update.installReady, false);

  const downloaded = await post('/api/update/download', {});
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.body.ok, true);
  assert.equal(downloaded.body.version, '2.2.0');

  const pendingResponse = await get('/api/update/pending');
  assert.equal(pendingResponse.pending.version, '2.2.0');

  const session2 = await get('/api/session');
  assert.equal(session2.update.installReady, true);
  assert.equal(session2.update.pendingVersion, '2.2.0');

  // Cât mai târziu posibil, după ce ambele baze s-au închis — vezi create-application.mjs.
  await app.close();
  assert.equal(spawnCalls.length, 1);
  assert.ok(spawnCalls[0].file.includes('Startica_Setup_2.2.0.exe'));
  assert.deepEqual(spawnCalls[0].options, { detached: true, stdio: 'ignore' });
});

test('§8 PROMPT-10 Partea 2: fără nicio actualizare descărcată, close() nu lansează nimic', async t => {
  /** @type {unknown[]} */
  const spawnCalls = [];
  const fakeSpawn = (...args) => {
    spawnCalls.push(args);
    return { unref: () => {} };
  };

  const { app } = await startTestApplication(t, {
    fetch: /** @type {any} */ (url => fakeAppFetch(String(url))),
    releaseRepo: REPO,
    spawnFn: /** @type {any} */ (fakeSpawn),
  });

  await app.close();

  assert.equal(spawnCalls.length, 0);
});
