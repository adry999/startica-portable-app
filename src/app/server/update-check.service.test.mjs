import test from 'node:test';
import assert from 'node:assert/strict';
import { checkForUpdate, createUpdateChecker, releaseManifestUrl } from './update-check.service.mjs';

const asAny = value => /** @type {any} */ (value);
const REPO = 'adry999/startica-portable-app';

test('releaseManifestUrl construiește URL-ul fix latest/download, fără API sau token', () => {
  assert.equal(
    releaseManifestUrl(REPO),
    'https://github.com/adry999/startica-portable-app/releases/latest/download/latest.json',
  );
});

test('checkForUpdate raportează actualizare disponibilă când manifestul are o versiune mai nouă', async () => {
  const calls = [];
  const fetch = asAny(async url => {
    calls.push(String(url));
    return {
      ok: true,
      json: async () => ({
        version: '2.2.0',
        downloadUrl:
          'https://github.com/adry999/startica-portable-app/releases/download/v2.2.0/Startica_Setup_2.2.0.exe',
        sha256: 'abc123',
        notes: 'Note de release',
      }),
    };
  });

  const status = await checkForUpdate({ fetch, repo: REPO, currentVersion: '2.1.0' });

  assert.equal(status.updateAvailable, true);
  assert.equal(status.currentVersion, '2.1.0');
  assert.equal(status.latestVersion, '2.2.0');
  assert.equal(status.releaseUrl, 'https://github.com/adry999/startica-portable-app/releases/latest');
  assert.equal(
    status.downloadUrl,
    'https://github.com/adry999/startica-portable-app/releases/download/v2.2.0/Startica_Setup_2.2.0.exe',
  );
  assert.equal(status.sha256, 'abc123');
  assert.equal(status.notes, 'Note de release');
  assert.equal(status.error, null);
  assert.ok(status.checkedAt);
  assert.equal(calls.length, 1);
  assert.equal(calls[0], releaseManifestUrl(REPO));
});

test('checkForUpdate nu raportează actualizare pe aceeași versiune', async () => {
  const fetch = asAny(async () => ({ ok: true, json: async () => ({ version: '2.1.0' }) }));

  const status = await checkForUpdate({ fetch, repo: REPO, currentVersion: '2.1.0' });

  assert.equal(status.updateAvailable, false);
  assert.equal(status.latestVersion, '2.1.0');
  assert.equal(status.error, null);
});

test('checkForUpdate nu raportează actualizare când manifestul e mai vechi (ex. downgrade de server CDN)', async () => {
  const fetch = asAny(async () => ({ ok: true, json: async () => ({ version: '1.0.0' }) }));

  const status = await checkForUpdate({ fetch, repo: REPO, currentVersion: '2.1.0' });

  assert.equal(status.updateAvailable, false);
  assert.equal(status.latestVersion, '1.0.0');
});

test('checkForUpdate întoarce o stare idle cu eroare pe răspuns HTTP nereușit, fără să arunce', async () => {
  const fetch = asAny(async () => ({ ok: false, status: 404 }));

  const status = await checkForUpdate({ fetch, repo: REPO, currentVersion: '2.1.0' });

  assert.equal(status.updateAvailable, false);
  assert.equal(status.latestVersion, '2.1.0');
  assert.match(String(status.error), /HTTP 404/);
});

test('checkForUpdate întoarce o stare idle cu eroare când manifestul nu are o versiune validă', async () => {
  const fetch = asAny(async () => ({ ok: true, json: async () => ({ downloadUrl: 'x' }) }));

  const status = await checkForUpdate({ fetch, repo: REPO, currentVersion: '2.1.0' });

  assert.equal(status.updateAvailable, false);
  assert.match(String(status.error), /versiune validă/);
});

test('checkForUpdate întoarce o stare idle cu eroare când fetch aruncă (fără internet)', async () => {
  const fetch = async () => {
    throw new TypeError('fetch failed');
  };

  const status = await checkForUpdate({ fetch, repo: REPO, currentVersion: '2.1.0' });

  assert.equal(status.updateAvailable, false);
  assert.match(String(status.error), /Fără internet sau GitHub indisponibil/);
});

test('createUpdateChecker: starea inițială e „nicio verificare încă", fără rețea', async () => {
  let fetchCalls = 0;
  const fetch = asAny(async () => {
    fetchCalls++;
    return { ok: true, json: async () => ({ version: '2.1.0' }) };
  });

  const checker = createUpdateChecker({ fetch, repo: REPO, currentVersion: '2.1.0' });
  const initial = checker.status();

  assert.equal(initial.updateAvailable, false);
  assert.equal(initial.latestVersion, '2.1.0');
  assert.equal(initial.checkedAt, null);
  assert.equal(fetchCalls, 0, 'status() nu declanșează nicio cerere de rețea');
});

test('createUpdateChecker: refresh() verifică o dată și memorează rezultatul pentru status()', async () => {
  let fetchCalls = 0;
  const fetch = asAny(async () => {
    fetchCalls++;
    return { ok: true, json: async () => ({ version: '2.3.0' }) };
  });

  const checker = createUpdateChecker({ fetch, repo: REPO, currentVersion: '2.1.0' });
  const refreshed = await checker.refresh();

  assert.equal(refreshed.updateAvailable, true);
  assert.deepEqual(checker.status(), refreshed, 'status() reflectă ultimul refresh, fără altă cerere');
  assert.equal(fetchCalls, 1);

  checker.status();
  assert.equal(fetchCalls, 1, 'status() tot nu face nicio cerere nouă');
});
