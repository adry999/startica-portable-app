import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSyncDeviceRepository, readSyncDeviceFile, writeSyncDeviceFile } from './sync-device.repository.mjs';

function tempFile(t) {
  const dir = mkdtempSync(join(tmpdir(), 'startica-sync-device-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, 'sync.json');
}

const DEVICE = {
  serverUrl: 'https://sync.exemplu.md',
  deviceId: 'dev-1',
  deviceName: 'Calculator A',
  token: 'token-secret',
  connectedAt: '2026-09-27T10:00:00.000Z',
};

test('fișierul lipsă înseamnă neconectat: readSyncDeviceFile întoarce null', t => {
  const file = tempFile(t);
  assert.equal(readSyncDeviceFile(file), null);
  assert.equal(createSyncDeviceRepository(file).read(), null);
});

test('fișierul de dispozitiv se scrie atomic și se citește înapoi identic', t => {
  const file = tempFile(t);
  writeSyncDeviceFile(file, DEVICE);

  const read = readSyncDeviceFile(file);
  assert.deepEqual(read, { version: 1, ...DEVICE });
  // Scriere atomică: niciun fișier temporar rămas pe disc după redenumire.
  assert.throws(() => readFileSync(file + '.tmp'));
});

test('un fișier corupt oprește pornirea, nu e reconstruit în tăcere', t => {
  const file = tempFile(t);
  writeFileSync(file, '{ nu e json valid');

  assert.throws(() => readSyncDeviceFile(file), /corupt/);
  assert.throws(() => createSyncDeviceRepository(file), /corupt/);
});

test('o structură necunoscută (câmp lipsă) e tot coruptă', t => {
  const file = tempFile(t);
  writeFileSync(file, JSON.stringify({ version: 1, serverUrl: 'https://x' }));

  assert.throws(() => readSyncDeviceFile(file), /corupt/);
});

test('depozitul citește o singură dată; write actualizează memoria și fișierul', t => {
  const file = tempFile(t);
  const repository = createSyncDeviceRepository(file);
  assert.equal(repository.read(), null);

  repository.write(DEVICE);
  assert.deepEqual(repository.read(), { version: 1, ...DEVICE });
  assert.deepEqual(readSyncDeviceFile(file), { version: 1, ...DEVICE });

  repository.clear();
  assert.equal(repository.read(), null);
});
