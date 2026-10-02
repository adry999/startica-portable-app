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
import { createAuditLogRepository } from '#features/audit-log/index.server.mjs';
import {
  createSyncOutboxRepository,
  createSyncStateRepository,
  createSyncConflictsRepository,
  createSyncAttendanceWriter,
  createSyncHttpClient,
  createSyncEngine,
} from '#features/sync/index.server.mjs';

// §7 (36g): „Istoric sincronizat” — confirmă pe o sincronizare REALĂ (server adevărat, pornit
// pe un port local, nu un dublu de test) că o intrare scrisă local pe calculatorul A ajunge,
// cu device_id/device_name corecte, în `audit_changes` al calculatorului B, după un ciclu
// push (A) + pull (B) — exact testul cerut explicit de PROMPT-CLAUDE-CODE-9 §7.
const SETUP_KEY = 'cheie-dev-audit-sync';

/** @param {import('node:test').TestContext} t */
async function startRealServer(t) {
  const dataDir = mkdtempSync(join(tmpdir(), 'sync-server-audit-integration-'));
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

/** Un `backups` fals — evită VACUUM INTO pe o bază `:memory:` în teste de integrare. */
function fakeBackups() {
  return { backup: () => ({ file: '', name: '', warning: '' }) };
}

/**
 * O „filială” minimală, cu propria bază SQLite în memorie — echivalentul unui calculator
 * conectat, cu `auditLogRepository` REAL (nu `createRecordingAuditTrail`), cablat exact ca în
 * create-branch-context.mjs: `recordChange` ajunge și în outbox, `mergeSyncedEntry` scrie o
 * intrare venită de pe alt calculator.
 */
function createDeviceHarness({ branchId, deviceId, deviceName, client }) {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  const rawRecordRepository = createRecordRepository(database);
  const settings = createSettingsRepository(database);
  const outbox = createSyncOutboxRepository(database);
  const syncState = createSyncStateRepository(database);
  const conflicts = createSyncConflictsRepository(database);
  const attendanceRepository = createSyncAttendanceWriter(database);
  const auditTrail = createAuditLogRepository(database, {
    deviceId,
    deviceName,
    branchId,
    outbox,
    isSyncEnabled: () => true,
  });
  const engine = createSyncEngine({
    database,
    branch: { id: branchId },
    rawRecordRepository,
    outbox,
    syncState,
    conflicts,
    backups: fakeBackups(),
    auditTrail,
    readSetting: settings.setting,
    writeSetting: settings.setSetting,
    attendanceRepository,
    client,
    deviceId,
    deviceName,
  });
  return { database, rawRecordRepository, outbox, syncState, conflicts, engine, auditTrail };
}

/** Pregătește doi „calculatoare” (A, B) deja perechi pe aceeași filială a unui server real. */
async function pairTwoDevices(t, branchId) {
  const { origin } = await startRealServer(t);

  const pairingClientA = createSyncHttpClient({ serverUrl: origin, fetch: globalThis.fetch });
  const deviceA = await pairingClientA.pair({ setupKey: SETUP_KEY, name: 'Calculator A', os: 'Windows 11' });
  const clientA = createSyncHttpClient({ serverUrl: origin, token: deviceA.token, fetch: globalThis.fetch });
  await clientA.registerBranch({
    id: branchId,
    name: 'Filiala principală',
    color: 'orange',
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

  return { deviceA, deviceB, harnessA, harnessB };
}

test('36g: o intrare din istoricul lui A ajunge, cu device_id/device_name corecte, în audit_changes al lui B', async t => {
  const branchId = 'branch-audit-sync-1';
  const { deviceA, harnessA, harnessB } = await pairTwoDevices(t, branchId);

  const localId = harnessA.auditTrail.recordChange({
    action: 'modificare',
    recordType: 'children',
    recordId: 'CHILD-1',
    before: { name: 'Vechi' },
    after: { name: 'Ana' },
  });
  assert.ok(localId > 0);

  await harnessA.engine.syncNow();
  assert.equal(harnessA.outbox.countPending(), 0, 'coada lui A e goală după push');

  await harnessB.engine.syncNow();

  const page = harnessB.auditTrail.readPage({ beforeEntryId: null });
  const synced = page.entries.find(entry => entry.recordId === 'CHILD-1' && entry.action === 'modificare');
  assert.ok(synced, 'intrarea lui A trebuie să apară în istoricul lui B');
  assert.equal(synced.deviceId, deviceA.deviceId, 'device_id trebuie să fie al lui A, verificat de server');
  assert.equal(synced.deviceName, 'Calculator A');
  assert.deepEqual(synced.after, { name: 'Ana' });
  assert.deepEqual(synced.before, { name: 'Vechi' });

  // Nicio buclă: intrarea aplicată pe B (mergeSyncedEntry) nu trebuie să ajungă înapoi în
  // propria coadă de trimis a lui B.
  assert.equal(harnessB.outbox.countPending(), 0, 'B nu retrimite intrarea primită de pe A');
});

test('36g: o reluare a aceluiași pull nu dublează intrarea (entry_uid e idempotent)', async t => {
  const branchId = 'branch-audit-sync-2';
  const { harnessA, harnessB } = await pairTwoDevices(t, branchId);

  harnessA.auditTrail.recordChange({ action: 'adăugare', recordType: 'children', recordId: 'CHILD-2' });
  await harnessA.engine.syncNow();
  await harnessB.engine.syncNow();

  const before = harnessB.auditTrail.readPage({ beforeEntryId: null }).entries.length;
  assert.equal(before, 1);

  // Simulează o reluare (ex. o cădere de rețea chiar după aplicarea locală, înainte ca
  // cursorul `sync.since` să fi fost scris) — ACEEAȘI intrare, identificată de ACELAȘI
  // entry_uid, aplicată a doua oară direct prin mergeSyncedEntry (calea folosită de pull).
  const realEntryUid = /** @type {{ entry_uid: string }} */ (
    harnessA.database.prepare('SELECT entry_uid FROM audit_changes WHERE record_id=?').get('CHILD-2')
  ).entry_uid;
  harnessB.auditTrail.mergeSyncedEntry({
    entryUid: realEntryUid,
    deviceId: 'alt-id-oricare',
    deviceName: 'Alt nume oricare',
    action: 'adăugare',
    recordType: 'children',
    recordId: 'CHILD-2',
    before: null,
    after: null,
    occurredAt: new Date().toISOString(),
  });

  const after = harnessB.auditTrail.readPage({ beforeEntryId: null }).entries.length;
  assert.equal(after, before, 'un entry_uid deja aplicat nu creează un al doilea rând');
});
