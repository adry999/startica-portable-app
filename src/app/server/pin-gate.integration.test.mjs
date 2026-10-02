import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestApplication, removeDirWithRetry } from '#test-support/start-test-application.mjs';

// §7 (36h): assertPinUnlocked (route-dispatcher.mjs, create-branch-context.mjs) — generalizarea
// pinService-ului Salariilor (23d) la orice modul din profile.pinModules. §7 (36g): access.blocked
// scris în audit_changes când o rută iese din profilul calculatorului.

/** @param {string} prefix @param {{ pinModules?: string[], modules?: Record<string, number> }} profile */
async function startAppWithProfile(t, prefix, profile) {
  const home = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => removeDirWithRetry(home));
  writeFileSync(
    join(home, 'sync.json'),
    JSON.stringify({
      version: 1,
      serverUrl: 'https://sync.exemplu.invalid',
      deviceId: 'dev-test-1',
      deviceName: 'Calculator de test',
      token: 'tok',
      connectedAt: new Date().toISOString(),
      profile: { preset: 'personalizat', modules: {}, pinModules: [], blocked: false, ...profile },
    }),
  );
  return startTestApplication(t, { prefix: `${prefix}-run-`, home });
}

test('§7 (36h): un modul din pinModules cere PIN chiar dacă profilul are acces de Modifică la el', async t => {
  const app = await startAppWithProfile(t, 'startica-pin-generic-', {
    // `personal: 2` — fără el, chiar POST /api/personal/pin (unde se setează PIN-ul) ar cădea
    // pe garda de MODUL (403 „acest calculator nu are acces”), înaintea celei de PIN.
    modules: { payments: 2, personal: 2 },
    pinModules: ['payments'],
  });

  const before = await fetch(app.origin + '/api/exchange-rates');
  assert.equal(before.status, 403);
  assert.match((await before.json()).error, /protejate/i);

  await app.post('/api/personal/pin', { pin: '1234' });
  await app.post('/api/personal/pin/unlock', { pin: '1234' });

  const after = await fetch(app.origin + '/api/exchange-rates');
  assert.equal(after.status, 200);
});

test('§7 (36h): un modul NEINCLUS în pinModules nu cere PIN, deși PIN-ul e configurat și neconfigurat', async t => {
  const app = await startAppWithProfile(t, 'startica-pin-neutru-', {
    modules: { payments: 2 },
    pinModules: [],
  });

  const response = await fetch(app.origin + '/api/exchange-rates');
  assert.equal(response.status, 200);
});

test('§7 (36g): access.blocked se scrie în audit_changes când o rută iese din profilul calculatorului', async t => {
  const app = await startAppWithProfile(t, 'startica-access-blocked-', {
    modules: { payments: 0 },
    pinModules: [],
  });

  const response = await fetch(app.origin + '/api/exchange-rates');
  assert.equal(response.status, 403);

  // `/api/audit` e el însuși pe modulul admin (mereu 0 pe un profil Personalizat) — profilul
  // restrâns nu-și poate citi propriul istoric local; verificăm direct pe baza SQLite activă,
  // la fel cum ar face-o un calculator Complet după sincronizare (36g).
  const rows = /** @type {{ action: string, record_id: string }[]} */ (
    app.app.db.prepare("SELECT action, record_id FROM audit_changes WHERE action='access.blocked'").all()
  );
  assert.equal(rows.length, 1);
  assert.match(rows[0].record_id, /payments/);
});

test('§7 (36h): rutele PIN-ului (stare/setare/deblocare) nu cer ele însele PIN, chiar dacă modulul lor e în pinModules', async t => {
  const app = await startAppWithProfile(t, 'startica-pin-exempt-', {
    modules: { personal: 2 },
    pinModules: ['personal'],
  });

  // Fără asta, nimeni n-ar putea seta/deplasa PIN-ul vreodată pe un profil cu `personal` în pinModules.
  const status = await fetch(app.origin + '/api/personal/pin');
  assert.equal(status.status, 200);
  const set = await app.post('/api/personal/pin', { pin: '1234' });
  assert.equal(set.status, 200);
  const unlock = await app.post('/api/personal/pin/unlock', { pin: '1234' });
  assert.equal(unlock.status, 200);
});
