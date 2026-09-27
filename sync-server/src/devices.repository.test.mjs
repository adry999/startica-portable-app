import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSyncDatabase } from './database.mjs';
import { createDevicesRepository } from './devices.repository.mjs';

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
