import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveSyncMode } from './sync-status.mjs';

/** @type {{ conflicts: number, connection: 'online' | 'offline' | 'revoked', pending: number, pushing: boolean }} */
const base = { conflicts: 0, connection: 'online', pending: 0, pushing: false };

test('fără conflicte, fără rețea, fără nimic în coadă: sincronizat', () => {
  assert.deepEqual(deriveSyncMode(base), { mode: 'synced' });
});

test('cu modificări în coadă sau o trimitere în curs: se sincronizează', () => {
  assert.deepEqual(deriveSyncMode({ ...base, pending: 3 }), { mode: 'syncing' });
  assert.deepEqual(deriveSyncMode({ ...base, pushing: true }), { mode: 'syncing' });
});

test('fără conexiune: fără internet, indiferent de coadă', () => {
  assert.deepEqual(deriveSyncMode({ ...base, connection: 'offline', pending: 5 }), { mode: 'offline' });
});

test('calculator revocat: revoked, chiar dacă mai sunt modificări în coadă', () => {
  assert.deepEqual(deriveSyncMode({ ...base, connection: 'revoked', pending: 2 }), { mode: 'revoked' });
});

test('conflictele au prioritate peste orice altă stare', () => {
  assert.deepEqual(deriveSyncMode({ conflicts: 1, connection: 'offline', pending: 4, pushing: true }), {
    mode: 'conflict',
  });
});
