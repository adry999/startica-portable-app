import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSyncConfig } from './config.mjs';

test('configurația refuză portul și ora de backup invalide', () => {
  assert.throws(() => loadSyncConfig({ SYNC_DATA_DIR: '/tmp/sync', SYNC_PORT: 'abc' }), /SYNC_PORT/);
  assert.throws(() => loadSyncConfig({ SYNC_DATA_DIR: '/tmp/sync', SYNC_PORT: '70000' }), /SYNC_PORT/);
  assert.throws(() => loadSyncConfig({ SYNC_DATA_DIR: '/tmp/sync', SYNC_BACKUP_HOUR: '24' }), /SYNC_BACKUP_HOUR/);
  assert.throws(() => loadSyncConfig({ SYNC_DATA_DIR: '/tmp/sync', SYNC_BACKUP_HOUR: 'noapte' }), /SYNC_BACKUP_HOUR/);
});

test('configurația refuză un director de date relativ', () => {
  assert.throws(() => loadSyncConfig({ SYNC_DATA_DIR: 'relativ' }), /SYNC_DATA_DIR/);
});

test('valorile implicite se aplică atunci când variabilele nu sunt setate', () => {
  const config = loadSyncConfig({ SYNC_DATA_DIR: '/tmp/sync' });
  assert.equal(config.port, 8790);
  assert.equal(config.bind, '127.0.0.1');
  assert.equal(config.setupKeyAlways, false);
  assert.equal(config.backupHour, 3);
  assert.equal(config.backupKeep, 14);
  assert.equal(config.historyDays, 365);
  assert.equal(config.trustProxy, false);
});

test('variabilele valide se preiau ca atare', () => {
  const config = loadSyncConfig({
    SYNC_DATA_DIR: '/tmp/sync',
    SYNC_PORT: '9000',
    SYNC_BIND: '0.0.0.0',
    SYNC_SETUP_KEY: 'cheia-mea',
    SYNC_SETUP_KEY_ALWAYS: '1',
    SYNC_BACKUP_HOUR: '4',
    SYNC_BACKUP_KEEP: '30',
    SYNC_HISTORY_DAYS: '90',
    SYNC_TRUST_PROXY: '1',
  });
  assert.deepEqual(config, {
    port: 9000,
    bind: '0.0.0.0',
    dataDir: '/tmp/sync',
    setupKey: 'cheia-mea',
    setupKeyAlways: true,
    backupHour: 4,
    backupKeep: 30,
    historyDays: 90,
    trustProxy: true,
  });
});
