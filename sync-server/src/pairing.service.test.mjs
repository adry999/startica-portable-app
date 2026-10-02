import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSyncDatabase } from './database.mjs';
import { createPairingService } from './pairing.service.mjs';

function withService(t) {
  const dir = mkdtempSync(join(tmpdir(), 'sync-pairing-test-'));
  const database = openSyncDatabase(dir);
  t.after(() => {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return createPairingService(database);
}

test('codul de conectare expiră după 10 minute și se folosește o singură dată', t => {
  const pairing = withService(t);
  const createdAt = new Date('2026-09-27T08:00:00.000Z');
  const { code } = pairing.createCode({ createdBy: 'dev-1', now: createdAt });
  assert.equal(code.length, 6);

  const dupa9Minute = new Date(createdAt.getTime() + 9 * 60 * 1000);
  const primaFolosire = pairing.consumeCode({ code, now: dupa9Minute });
  assert.deepEqual(primaFolosire, { ok: true, createdBy: 'dev-1', profile: null });

  const aDouaFolosire = pairing.consumeCode({ code, now: dupa9Minute });
  assert.equal(aDouaFolosire.ok, false);
  assert.equal(aDouaFolosire.reason, 'used');
});

test('codul de conectare expiră după 10 minute', t => {
  const pairing = withService(t);
  const createdAt = new Date('2026-09-27T08:00:00.000Z');
  const { code } = pairing.createCode({ createdBy: 'dev-1', now: createdAt });

  const dupa11Minute = new Date(createdAt.getTime() + 11 * 60 * 1000);
  const rezultat = pairing.consumeCode({ code, now: dupa11Minute });
  assert.equal(rezultat.ok, false);
  assert.equal(rezultat.reason, 'expired');
});

test('a cincea încercare greșită șterge codul', t => {
  const pairing = withService(t);
  const createdAt = new Date('2026-09-27T08:00:00.000Z');
  const { code } = pairing.createCode({ createdBy: 'dev-1', now: createdAt });
  pairing.consumeCode({ code, now: createdAt }); // prima folosire, reușită — codul devine „used”

  // Încercările 1–5 pe un cod deja folosit găsesc rândul (reason „used”); a cincea îl șterge.
  for (let incercare = 0; incercare < 5; incercare += 1) {
    const rezultat = pairing.consumeCode({ code, now: createdAt });
    assert.equal(rezultat.ok, false);
    assert.equal(rezultat.reason, 'used');
  }
  const dupaStergere = pairing.consumeCode({ code, now: createdAt });
  assert.equal(dupaStergere.ok, false);
  assert.equal(dupaStergere.reason, 'not-found');
});

test('codul generat cu un profil îl întoarce normalizat la consumare (§5.3, 36a)', t => {
  const pairing = withService(t);
  const createdAt = new Date('2026-09-27T08:00:00.000Z');
  const { code } = pairing.createCode({ createdBy: 'dev-1', now: createdAt, profile: { preset: 'educator' } });
  const rezultat = pairing.consumeCode({ code, now: createdAt });
  assert.equal(rezultat.ok, true);
  assert.ok(rezultat.ok && rezultat.profile);
  assert.equal(/** @type {{ preset: string }} */ (rezultat.profile).preset, 'educator');
});

test('un cod fără profil ales întoarce profile: null la consumare', t => {
  const pairing = withService(t);
  const createdAt = new Date('2026-09-27T08:00:00.000Z');
  const { code } = pairing.createCode({ createdBy: 'dev-1', now: createdAt });
  const rezultat = pairing.consumeCode({ code, now: createdAt });
  assert.equal(rezultat.ok, true);
  assert.ok(rezultat.ok);
  assert.equal(rezultat.profile, null);
});

test('un cod inexistent nu se poate confunda cu unul valabil', t => {
  const pairing = withService(t);
  const rezultat = pairing.consumeCode({ code: '000000', now: new Date() });
  assert.deepEqual(rezultat, { ok: false, reason: 'not-found' });
});
