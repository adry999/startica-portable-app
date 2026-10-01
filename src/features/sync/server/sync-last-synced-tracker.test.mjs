import test from 'node:test';
import assert from 'node:assert/strict';
import { createLastSyncedAtTracker } from './sync-last-synced-tracker.mjs';

const DEVICE = {
  version: 1,
  serverUrl: 'https://sync.exemplu.md',
  deviceId: 'dev-1',
  deviceName: 'Calculator A',
  token: 'token-secret',
  connectedAt: '2026-09-27T10:00:00.000Z',
};

function fakeSyncDevice(initial) {
  let device = initial;
  const writes = [];
  return {
    read: () => device,
    write: next => {
      device = { version: 1, ...next };
      writes.push(device);
    },
    clear: () => {
      device = null;
    },
    writes,
  };
}

test('scrie lastSyncedAt când statusul aduce o valoare nouă', () => {
  const syncDevice = fakeSyncDevice(DEVICE);
  const tracker = createLastSyncedAtTracker({ syncDevice });

  tracker.handleStatus({ lastSyncedAt: '2026-10-01T12:00:00.000Z' });

  assert.equal(syncDevice.writes.length, 1);
  assert.equal(syncDevice.read().lastSyncedAt, '2026-10-01T12:00:00.000Z');
  // Restul câmpurilor rămân neschimbate.
  assert.equal(syncDevice.read().token, DEVICE.token);
});

test('nu rescrie la aceeași valoare (fără scrieri redundante la fiecare poll)', () => {
  const syncDevice = fakeSyncDevice({ ...DEVICE, lastSyncedAt: '2026-10-01T12:00:00.000Z' });
  const tracker = createLastSyncedAtTracker({ syncDevice });

  tracker.handleStatus({ lastSyncedAt: '2026-10-01T12:00:00.000Z' });

  assert.equal(syncDevice.writes.length, 0);
});

test('ignoră un status fără lastSyncedAt (sincronizare eșuată/în curs)', () => {
  const syncDevice = fakeSyncDevice(DEVICE);
  const tracker = createLastSyncedAtTracker({ syncDevice });

  tracker.handleStatus({ lastSyncedAt: '' });

  assert.equal(syncDevice.writes.length, 0);
});

test('nu scrie nimic dacă dispozitivul a fost deconectat între timp', () => {
  const syncDevice = fakeSyncDevice(null);
  const tracker = createLastSyncedAtTracker({ syncDevice });

  tracker.handleStatus({ lastSyncedAt: '2026-10-01T12:00:00.000Z' });

  assert.equal(syncDevice.writes.length, 0);
});
