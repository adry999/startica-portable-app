import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createSyncServer } from '#sync-server/create-sync-server.mjs';
import { applySchema } from '#core/server/database/schema.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { createSettingsRepository } from '#core/server/settings/settings-repository.mjs';
import { createRecordingAuditTrail } from '#test-support/recording-audit-trail.mjs';
import { createSyncOutboxRepository } from './sync-outbox.repository.mjs';
import { createSyncStateRepository } from './sync-state.repository.mjs';
import { createSyncConflictsRepository } from './sync-conflicts.repository.mjs';
import { createSyncAttendanceWriter } from './change-applier.mjs';
import { createSyncHttpClient } from './sync-http-client.mjs';
import { createSyncEngine } from './sync-engine.service.mjs';

const SETUP_KEY = 'cheie-dev-integrare';

/** @param {import('node:test').TestContext} t */
async function startRealServer(t) {
  const dataDir = mkdtempSync(join(tmpdir(), 'sync-server-engine-integration-'));
  const app = createSyncServer({
    config: {
      port: 0,
      bind: '127.0.0.1',
      dataDir,
      setupKey: SETUP_KEY,
      setupKeyAlways: true,
      backupHour: 3,
      backupKeep: 14,
      historyDays: 365,
      trustProxy: false,
    },
    log: () => {},
  });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const { port } = /** @type {import('node:net').AddressInfo} */ (app.server.address());
  const origin = `http://127.0.0.1:${port}`;
  t.after(async () => {
    await app.close();
    rmSync(dataDir, { recursive: true, force: true });
  });
  return { origin };
}

/** O „filială” minimală, cu propria bază SQLite în memorie — echivalentul unui calculator conectat. */
function createDeviceHarness({ branchId, deviceId, deviceName, client }) {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  const rawRecordRepository = createRecordRepository(database);
  const settings = createSettingsRepository(database);
  const outbox = createSyncOutboxRepository(database);
  const syncState = createSyncStateRepository(database);
  const conflicts = createSyncConflictsRepository(database);
  const attendanceRepository = createSyncAttendanceWriter(database);
  const auditTrail = createRecordingAuditTrail();
  const engine = createSyncEngine({
    database,
    branch: { id: branchId },
    rawRecordRepository,
    outbox,
    syncState,
    conflicts,
    auditTrail,
    readSetting: settings.setting,
    writeSetting: settings.setSetting,
    attendanceRepository,
    client,
    deviceId,
    deviceName,
  });
  return { database, rawRecordRepository, outbox, syncState, conflicts, engine };
}

test('push urmat de pull de pe un al doilea dispozitiv aduce aceeași înregistrare', async t => {
  const { origin } = await startRealServer(t);
  const branchId = 'branch-integrare-1';

  const pairingClientA = createSyncHttpClient({ serverUrl: origin, fetch: globalThis.fetch });
  const deviceA = await pairingClientA.pair({ setupKey: SETUP_KEY, name: 'Calculator A', os: 'Windows 11' });
  const clientA = createSyncHttpClient({ serverUrl: origin, token: deviceA.token, fetch: globalThis.fetch });
  await clientA.registerBranch({
    id: branchId,
    name: 'Filiala principală',
    color: '#f5a623',
    address: '',
    createdAt: '2026-09-27T08:00:00.000Z',
  });

  const pairingClientB = createSyncHttpClient({ serverUrl: origin, fetch: globalThis.fetch });
  const deviceB = await pairingClientB.pair({ setupKey: SETUP_KEY, name: 'Calculator B', os: 'macOS' });
  const clientB = createSyncHttpClient({ serverUrl: origin, token: deviceB.token, fetch: globalThis.fetch });

  const harnessA = createDeviceHarness({
    branchId,
    deviceId: deviceA.deviceId,
    deviceName: 'Calculator A',
    client: clientA,
  });
  const harnessB = createDeviceHarness({
    branchId,
    deviceId: deviceB.deviceId,
    deviceName: 'Calculator B',
    client: clientB,
  });

  harnessA.outbox.enqueue({ kind: 'children', recordId: 'ID-1', payload: { id: 'ID-1', name: 'Ana' } });

  await harnessA.engine.syncNow();
  assert.equal(harnessA.outbox.countPending(), 0, 'coada lui A e goală după push');
  assert.equal(harnessA.engine.status().connection, 'online');

  await harnessB.engine.syncNow();
  const onB = harnessB.rawRecordRepository.find('children', 'ID-1');
  assert.ok(onB, 'înregistrarea lui A a ajuns pe B');
  assert.equal(onB.name, 'Ana');
  assert.equal(harnessB.engine.status().connection, 'online');
});
