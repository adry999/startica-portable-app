import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { SyncNetworkError, SyncRevokedError, SyncHttpError } from './sync-http-client.mjs';
import { createChangeApplier, SyncApplyError } from './change-applier.mjs';

const PUSH_BATCH_SIZE = 200;
const INITIAL_BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 60000;
const SYNC_SINCE_SETTING = 'sync.since';

/** @param {import('../sync.types.d.mts').SyncOutboxChange} row */
function toWireChange(row) {
  return {
    changeId: row.changeId,
    kind: row.kind,
    recordId: row.recordId,
    baseRevision: row.baseRevision,
    payload: row.payload,
    // sync_outbox nu are un câmp separat „changedAt” — momentul înscrierii în coadă e
    // singurul disponibil, suficient pentru politica last-writer-wins de pe server.
    changedAt: row.createdAt,
  };
}

/**
 * Motorul de sincronizare al unei filiale (decizia 12 din plan: unul per filială activă).
 * Trimite coada locală (push), aduce modificările celorlalți (pull), aplică conflictele
 * last-writer-wins primite înapoi și derivă statusul cardului 14a. Nimic din construcția
 * lui nu depinde de HTTP — `client` e `sync-http-client.mjs`, injectat, ca testele să poată
 * folosi un client fals.
 * @param {{
 *   database: import('node:sqlite').DatabaseSync,
 *   branch: { id: string },
 *   rawRecordRepository: ReturnType<typeof import('#core/server/persistence/record-repository.mjs').createRecordRepository>,
 *   outbox: ReturnType<typeof import('./sync-outbox.repository.mjs').createSyncOutboxRepository>,
 *   syncState: ReturnType<typeof import('./sync-state.repository.mjs').createSyncStateRepository>,
 *   conflicts: ReturnType<typeof import('./sync-conflicts.repository.mjs').createSyncConflictsRepository>,
 *   auditTrail: import('#shared/contracts/audit-trail.d.mts').AuditTrail,
 *   readSetting: (key: string) => string,
 *   writeSetting: (key: string, value: string) => void,
 *   attendanceRepository: ReturnType<typeof import('./change-applier.mjs').createSyncAttendanceWriter>,
 *   client: ReturnType<typeof import('./sync-http-client.mjs').createSyncHttpClient>,
 *   deviceId: string,
 *   deviceName?: string,
 *   now?: () => Date,
 *   onStatus?: (status: { connection: 'online' | 'offline' | 'revoked', pending: number, pushing: boolean, lastSyncedAt: string, conflicts: number, lastError: string }) => void,
 *   onRecordsChanged?: (revision: number) => void,
 *   pollIntervalMs?: number,
 *   pushDebounceMs?: number,
 *   setTimeoutFn?: typeof setTimeout,
 *   clearTimeoutFn?: typeof clearTimeout,
 *   setIntervalFn?: typeof setInterval,
 *   clearIntervalFn?: typeof clearInterval,
 * }} dependencies
 */
export function createSyncEngine({
  database,
  branch,
  rawRecordRepository,
  outbox,
  syncState,
  conflicts,
  auditTrail,
  readSetting,
  writeSetting,
  attendanceRepository,
  client,
  deviceId,
  deviceName = '',
  now = () => new Date(),
  onStatus = () => {},
  onRecordsChanged = () => {},
  pollIntervalMs = 15000,
  pushDebounceMs = 2000,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
}) {
  const applier = createChangeApplier({ rawRecordRepository, attendanceRepository, syncState, auditTrail });

  /** @type {'online' | 'offline' | 'revoked'} */
  let connection = 'online';
  let pushing = false;
  let lastSyncedAt = '';
  let lastError = '';
  let running = false;
  let runAgain = false;
  // Pornit implicit „oprit”: start() e singurul care programează timere/SSE, ca un motor
  // construit dar niciodată pornit (instalare neconfigurată) să nu facă nimic.
  let stopped = true;
  let backoffMs = INITIAL_BACKOFF_MS;
  // O eroare de aplicare (fișă nerecunoscută) oprește doar pull-ul, nu push-ul — o
  // reluare completă vine abia la următoarea pornire a motorului (decizia din plan).
  let pullPaused = false;

  /** @type {ReturnType<typeof setInterval> | null} */
  let pollTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let backoffTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let pushDebounceTimer = null;
  /** @type {{ close: () => void } | null} */
  let sseHandle = null;

  function status() {
    return {
      connection,
      pending: outbox.countPending(),
      pushing,
      lastSyncedAt,
      conflicts: conflicts.count(),
      lastError,
    };
  }

  function notify() {
    onStatus(status());
  }

  function currentRevision() {
    return /** @type {{ revision: number }} */ (database.prepare('SELECT revision FROM meta WHERE id=1').get())
      .revision;
  }

  function bumpRevision() {
    database.prepare('UPDATE meta SET revision=revision+1 WHERE id=1').run();
  }

  async function pushOnce() {
    let rows = outbox.pending(PUSH_BATCH_SIZE);
    while (rows.length) {
      pushing = true;
      notify();
      const { results } = await client.pushChanges(branch.id, rows.map(toWireChange));
      for (const row of rows) {
        const result = results.find(entry => entry.changeId === row.changeId);
        if (!result) continue;
        if (result.status === 'applied') {
          syncState.set(row.kind, row.recordId, {
            serverRevision: result.revision,
            updatedAt: row.createdAt,
            updatedByDevice: deviceId,
            updatedByName: deviceName,
          });
          outbox.remove(row.seq);
        } else if (result.status === 'superseded' && result.head) {
          // Modificarea noastră a pierdut (last-writer-wins) — varianta serverului
          // devine cea locală, ca cele două calculatoare să nu rămână divergente.
          applier.apply({
            kind: row.kind,
            recordId: row.recordId,
            payload: result.head.payload,
            revision: result.head.revision,
            changedAt: result.head.updatedAt,
            device: result.head.updatedBy,
          });
          outbox.remove(row.seq);
        } else if (result.status === 'conflict' && result.head) {
          conflicts.insert({
            kind: row.kind,
            recordId: row.recordId,
            localPayload: row.payload,
            localUpdatedAt: row.createdAt,
            remotePayload: result.head.payload,
            remoteRevision: result.head.revision,
            remoteUpdatedAt: result.head.updatedAt,
            remoteDeviceId: result.head.updatedBy.id,
            remoteDeviceName: result.head.updatedBy.name,
            outboxSeq: row.seq,
          });
          outbox.park(row.seq);
        }
      }
      rows = rows.length === PUSH_BATCH_SIZE ? outbox.pending(PUSH_BATCH_SIZE) : [];
    }
    pushing = false;
  }

  function readCursor() {
    const raw = readSetting(SYNC_SINCE_SETTING);
    return raw ? Number(raw) : 0;
  }

  async function resyncFromSnapshot() {
    const snapshot = await client.downloadSnapshot(branch.id);
    let count = 0;
    database.exec('BEGIN IMMEDIATE');
    try {
      database.exec('DELETE FROM records');
      for (const kind of Object.keys(snapshot.records)) {
        for (const entry of snapshot.records[kind]) {
          if (entry.payload === null) continue;
          rawRecordRepository.save(kind, normalizeRecord(kind, entry.payload));
          syncState.set(kind, entry.id, {
            serverRevision: entry.revision,
            updatedAt: entry.updatedAt,
            updatedByDevice: '',
            updatedByName: '',
          });
          count += 1;
        }
      }
      bumpRevision();
      writeSetting(SYNC_SINCE_SETTING, String(snapshot.headSeq));
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    auditTrail.recordChange({
      action: `descărcare de pe server: ${count} înregistrări`,
      recordType: null,
      recordId: null,
    });
    onRecordsChanged(currentRevision());
  }

  async function pullOnce() {
    if (pullPaused) return;
    const since = readCursor();
    let result;
    try {
      result = await client.pullChanges(branch.id, since);
    } catch (error) {
      if (error instanceof SyncHttpError && error.status === 410) {
        await resyncFromSnapshot();
        return;
      }
      throw error;
    }
    const { changes, nextSince, headSeq } = result;
    if (changes.length) {
      let appliedAny = false;
      database.exec('BEGIN IMMEDIATE');
      try {
        for (const change of changes) {
          // Propriile modificări (reluate de pe server, ex. după un push aplicat de un
          // alt lot) nu se aplică peste ele însele — le-am scris deja local.
          if (change.device.id === deviceId) continue;
          applier.apply(change);
          appliedAny = true;
        }
        if (appliedAny) bumpRevision();
        writeSetting(SYNC_SINCE_SETTING, String(nextSince));
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
      if (appliedAny) onRecordsChanged(currentRevision());
    } else if (nextSince !== since) {
      writeSetting(SYNC_SINCE_SETTING, String(nextSince));
    }
    if (nextSince < headSeq) await pullOnce();
  }

  async function cycle() {
    await pushOnce();
    await pullOnce();
  }

  function handleError(error) {
    if (error instanceof SyncNetworkError) {
      connection = 'offline';
      scheduleBackoff();
      return;
    }
    if (error instanceof SyncRevokedError) {
      connection = 'revoked';
      // Deconectat de pe server: nu are rost să mai reîncercăm — Faza 5 (reconectare)
      // reconstruiește motorul, cu un sync.json nou.
      stopped = true;
      stopTimers();
      return;
    }
    if (error instanceof SyncApplyError) pullPaused = true;
    lastError = /** @type {Error} */ (error).message;
    console.error(/** @type {Error} */ (error).stack || error);
  }

  async function syncNow() {
    if (running) {
      runAgain = true;
      return;
    }
    running = true;
    try {
      do {
        runAgain = false;
        try {
          await cycle();
          connection = 'online';
          lastError = '';
          lastSyncedAt = now().toISOString();
          backoffMs = INITIAL_BACKOFF_MS;
        } catch (error) {
          handleError(error);
        }
      } while (runAgain);
    } finally {
      running = false;
      pushing = false;
      notify();
    }
  }

  function scheduleBackoff() {
    if (stopped) return;
    if (backoffTimer) clearTimeoutFn(backoffTimer);
    backoffTimer = setTimeoutFn(() => {
      void syncNow();
    }, backoffMs);
    backoffTimer.unref?.();
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
  }

  function stopTimers() {
    if (pollTimer) clearIntervalFn(pollTimer);
    if (backoffTimer) clearTimeoutFn(backoffTimer);
    if (pushDebounceTimer) clearTimeoutFn(pushDebounceTimer);
    pollTimer = null;
    backoffTimer = null;
    pushDebounceTimer = null;
    if (sseHandle) {
      sseHandle.close();
      sseHandle = null;
    }
  }

  function start() {
    if (!stopped) return;
    stopped = false;
    pullPaused = false;
    backoffMs = INITIAL_BACKOFF_MS;
    void syncNow();
    pollTimer = setIntervalFn(() => {
      void syncNow();
    }, pollIntervalMs);
    pollTimer.unref?.();
    sseHandle = client.openEvents(branch.id, () => {
      void syncNow();
    });
  }

  function stop() {
    stopped = true;
    stopTimers();
  }

  /** Apelat după orice scriere locală (outbox-recording-repository, attendance) — trimite mai repede decât polling-ul. */
  function noteLocalChange() {
    if (stopped) return;
    if (pushDebounceTimer) clearTimeoutFn(pushDebounceTimer);
    pushDebounceTimer = setTimeoutFn(() => {
      void syncNow();
    }, pushDebounceMs);
    pushDebounceTimer.unref?.();
  }

  return { start, stop, syncNow, status, noteLocalChange };
}
