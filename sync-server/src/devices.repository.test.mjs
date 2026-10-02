import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSyncDatabase } from './database.mjs';
import { createDevicesRepository } from './devices.repository.mjs';
import { ACCESS_WRITE } from './profile-policy.mjs';

function withRepository(t) {
  const dir = mkdtempSync(join(tmpdir(), 'sync-devices-test-'));
  const database = openSyncDatabase(dir);
  t.after(() => {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return createDevicesRepository(database);
}

test('un dispozitiv nou se poate găsi după id și după hash-ul tokenului', t => {
  const devices = withRepository(t);
  const device = devices.insert({
    id: 'dev-1',
    name: 'Calculator recepție',
    os: 'Windows 11',
    tokenHash: 'hash-1',
    now: '2026-09-27T08:00:00.000Z',
  });
  assert.equal(device.id, 'dev-1');
  assert.equal(device.revokedAt, null);
  assert.deepEqual(devices.findById('dev-1'), device);
  assert.deepEqual(devices.findByTokenHash('hash-1'), device);
  assert.equal(devices.findByTokenHash('hash-necunoscut'), undefined);
});

test('touchLastSeen actualizează ora și, opțional, filiala deschisă ultima dată', t => {
  const devices = withRepository(t);
  devices.insert({ id: 'dev-1', name: 'A', os: 'Windows 11', tokenHash: 'hash-1', now: '2026-09-27T08:00:00.000Z' });
  devices.touchLastSeen('dev-1', { branchId: 'branch-1', now: '2026-09-27T09:00:00.000Z' });
  const device = devices.findById('dev-1');
  assert.ok(device);
  assert.equal(device.lastSeenAt, '2026-09-27T09:00:00.000Z');
  assert.equal(device.lastBranchId, 'branch-1');
});

test('un dispozitiv fără nicio cerere cu X-Startica-Version are version null; touchLastSeen îl poate scrie', t => {
  const devices = withRepository(t);
  devices.insert({ id: 'dev-1', name: 'A', os: 'Windows 11', tokenHash: 'hash-1', now: '2026-09-27T08:00:00.000Z' });
  assert.equal(devices.findById('dev-1')?.version, null);
  devices.touchLastSeen('dev-1', { version: '2.2.0', now: '2026-09-27T09:00:00.000Z' });
  assert.equal(devices.findById('dev-1')?.version, '2.2.0');
  // Un apel ulterior fără „version” (ex. push-ul din changes.routes.mjs) nu-l șterge.
  devices.touchLastSeen('dev-1', { branchId: 'branch-1', now: '2026-09-27T10:00:00.000Z' });
  const device = devices.findById('dev-1');
  assert.equal(device?.version, '2.2.0');
  assert.equal(device?.lastBranchId, 'branch-1');
});

test('revoke marchează dispozitivul revocat; countActive nu îl mai numără', t => {
  const devices = withRepository(t);
  devices.insert({ id: 'dev-1', name: 'A', os: 'Windows 11', tokenHash: 'hash-1', now: '2026-09-27T08:00:00.000Z' });
  devices.insert({ id: 'dev-2', name: 'B', os: 'macOS', tokenHash: 'hash-2', now: '2026-09-27T08:00:00.000Z' });
  assert.equal(devices.countActive(), 2);
  devices.revoke('dev-1', '2026-09-27T10:00:00.000Z');
  const revocat = devices.findById('dev-1');
  assert.ok(revocat);
  assert.equal(revocat.revokedAt, '2026-09-27T10:00:00.000Z');
  assert.equal(devices.countActive(), 1);
  assert.equal(devices.list().length, 2);
});

test('un dispozitiv fără profil (instalare dinainte de §5.3) se citește ca profil Complet', t => {
  const devices = withRepository(t);
  devices.insert({ id: 'dev-1', name: 'A', os: 'Windows 11', tokenHash: 'hash-1', now: '2026-09-27T08:00:00.000Z' });
  const device = devices.findById('dev-1');
  assert.ok(device);
  assert.equal(device.profile.preset, 'complet');
  assert.equal(device.profile.blocked, false);
  assert.equal(device.profile.modules.admin, ACCESS_WRITE);
});

test('insert salvează profilul dat, normalizat', t => {
  const devices = withRepository(t);
  const device = devices.insert({
    id: 'dev-1',
    name: 'Educator',
    os: 'Windows 11',
    tokenHash: 'hash-1',
    now: '2026-09-27T08:00:00.000Z',
    profile: { preset: 'educator' },
  });
  assert.equal(device.profile.preset, 'educator');
  assert.equal(device.profile.modules.attendance, ACCESS_WRITE);
  assert.equal(device.profile.modules.payments, 0);
  assert.deepEqual(devices.findById('dev-1')?.profile, device.profile);
});

test('setProfile schimbă profilul unui dispozitiv existent și îl clampează', t => {
  const devices = withRepository(t);
  devices.insert({ id: 'dev-1', name: 'A', os: 'Windows 11', tokenHash: 'hash-1', now: '2026-09-27T08:00:00.000Z' });
  const updated = devices.setProfile('dev-1', {
    preset: 'personalizat',
    modules: { payments: ACCESS_WRITE, admin: ACCESS_WRITE },
  });
  assert.equal(updated.profile.preset, 'personalizat');
  assert.equal(updated.profile.modules.payments, ACCESS_WRITE);
  // admin rămâne 0 chiar dacă a fost cerut 2 — doar Complet îl poate avea (36b).
  assert.equal(updated.profile.modules.admin, 0);
  assert.deepEqual(devices.findById('dev-1')?.profile, updated.profile);
});

test('setProfile poate bloca un dispozitiv (profil.blocked)', t => {
  const devices = withRepository(t);
  devices.insert({ id: 'dev-1', name: 'A', os: 'Windows 11', tokenHash: 'hash-1', now: '2026-09-27T08:00:00.000Z' });
  const blocked = devices.setProfile('dev-1', { preset: 'complet', blocked: true });
  assert.equal(blocked.profile.blocked, true);
});
