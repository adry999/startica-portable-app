import { SyncNetworkError, SyncRevokedError, SyncHttpError } from './sync-http-client.mjs';
import { createChangeApplier, applySnapshotEntry, SyncApplyError } from './change-applier.mjs';

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
 *   rawRecordRepository: import('./change-applier.mjs').RawKindWriter,
 *   outbox: ReturnType<typeof import('./sync-outbox.repository.mjs').createSyncOutboxRepository>,
 *   syncState: ReturnType<typeof import('./sync-state.repository.mjs').createSyncStateRepository>,
 *   conflicts: ReturnType<typeof import('./sync-conflicts.repository.mjs').createSyncConflictsRepository>,
 *   backups: { backup: (reason?: string) => unknown },
 *   auditTrail: import('#shared/contracts/audit-trail.d.mts').AuditTrail,
 *   readSetting: (key: string) => string,
 *   writeSetting: (key: string, value: string) => void,
 *   attendanceRepository: ReturnType<typeof import('./change-applier.mjs').createSyncAttendanceWriter>,
 *   poolRepository?: ReturnType<typeof import('./change-applier.mjs').createSyncPoolWriter>,
 *   client: ReturnType<typeof import('./sync-http-client.mjs').createSyncHttpClient>,
 *   deviceId: string,
 *   deviceName?: string,
 *   writeProfile?: (profile: import('#shared/domain/computer-profile.mjs').ComputerProfile | null) => void,
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
  // C-5: resincronizarea din snapshot (410) e distructivă (DELETE FROM records) — are
  // nevoie de o copie de siguranță înainte, ca runRevisionTransaction pentru orice altă
  // operație ireversibilă. Implicitul aruncă cu un mesaj clar, ca o compoziție care încă
  // nu leagă `backups` să nu resincronizeze în tăcere fără copie.
  backups = {
    backup() {
      throw new Error('sync-engine: „backups” nu a fost injectat (vezi create-branch-context.mjs).');
    },
  },
  auditTrail,
  readSetting,
  writeSetting,
  attendanceRepository,
  poolRepository,
  client,
  deviceId,
  deviceName = '',
  // §5.3 (36g): persistă profilul reîmprospătat în sync.json — implicitul (teste, motorul
  // setului comun, care nu are nevoie de restricții pe el însuși) nu scrie nimic.
  writeProfile = () => {},
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
  const applier = createChangeApplier({
    rawRecordRepository,
    attendanceRepository,
    poolRepository,
    syncState,
    auditTrail,
  });

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
  // Doar stop() îl setează: motorul nepornit (teste, syncNow manual) nu e „oprit sub ciclu”.
  let halted = false;
  let backoffMs = INITIAL_BACKOFF_MS;
  // O eroare de aplicare (fișă nerecunoscută) oprește doar pull-ul, nu push-ul — o
  // reluare completă vine abia la următoarea pornire a motorului (decizia din plan).
  let pullPaused = false;
  // §5.3: profilul curent al acestui calculator, reîmprospătat la fiecare ciclu — `null`
  // până la primul răspuns (status necunoscut, nu „fără restricții”).
  let currentProfile = null;

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
      profile: currentProfile,
    };
  }

  /** §5.3 (36g): cel mai bun-efort — un server fără suport încă pentru `/v1/devices/me`
   * (sau o eroare de rețea) nu trebuie să oprească restul ciclului de sincronizare, care
   * are grija lui proprie de reîncercare; profilul rămâne pur și simplu neschimbat. */
  async function refreshProfile() {
    if (typeof client.fetchMyProfile !== 'function') return;
    try {
      const { profile } = await client.fetchMyProfile();
      currentProfile = profile ?? null;
      writeProfile(currentProfile);
    } catch {
      // Lăsăm profilul cunoscut anterior — nu blocăm sincronizarea pentru asta.
    }
  }

  function notify() {
    onStatus(status());
  }

  function currentRevision() {
    return /** @type {{ revision: number }} */ (database.prepare('SELECT revision FROM meta WHERE id=1').get())
      .revision;
  }

  function bumpRevision() {
    // Aceeași instrucțiune ca runRevisionTransaction (C-7): fără updated_at, /api/state
    // rămâne cu ora vechi după un pull, chiar dacă revizia a crescut.
    database.prepare('UPDATE meta SET revision=revision+1,updated_at=? WHERE id=1').run(now().toISOString());
  }

  async function pushOnce() {
    let rows = outbox.pending(PUSH_BATCH_SIZE);
    while (rows.length) {
      pushing = true;
      notify();
      const { results } = await client.pushChanges(branch.id, rows.map(toWireChange));
      let supersededApplied = false;
      // C-1 + C-4: tot lotul de rezultate se tratează într-o singură tranzacție — un rând
      // „applied”/„superseded”/„conflict” își schimbă starea din outbox împreună cu
      // sync_state/sync_conflicts, nu în autocommit-uri separate care ar putea lăsa
      // sync_state neschimbat dacă procesul cade la mijloc.
      database.exec('BEGIN IMMEDIATE');
      try {
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
            // C-1: șterge doar dacă rândul e încă cel trimis. O modificare locală apărută
            // cât timp push-ul era în zbor a actualizat deja acest rând (change_id nou,
            // coalesceOutboxChange) — ștergerea necondiționată ar pierde-o silențios.
            outbox.remove(row.seq, row.changeId);
          } else if (result.status === 'superseded') {
            // Modificarea noastră a pierdut (last-writer-wins) — varianta serverului
            // devine cea locală, ca cele două calculatoare să nu rămână divergente.
            // D-2: un replay al aceluiași changeId poate întoarce „superseded” fără
            // „head” (serverul nu-l retrimite decât la primul rezultat) — fără ștergere,
            // rândul ar rămâne pending la nesfârșit, retrimis identic la fiecare ciclu.
            if (result.head) {
              const applied = applier.apply({
                kind: row.kind,
                recordId: row.recordId,
                payload: result.head.payload,
                revision: result.head.revision,
                changedAt: result.head.updatedAt,
                device: result.head.updatedBy,
              });
              // sms_templates/settings (C-8): apply() nu scrie nimic până la Faza 6 —
              // fără schimbare locală, nu are rost nici bumpRevision, nici onRecordsChanged.
              if (applied) supersededApplied = true;
            }
            outbox.remove(row.seq, row.changeId);
          } else if (result.status === 'conflict' && result.head) {
            // S-7: dacă rândul a fost deja coalescat (o editare nouă a sosit cât push-ul
            // era în zbor — garda C-1), park() întoarce fals și rândul nu mai există sub
            // acest seq/changeId — nu mai are rost un conflict care arată spre nimic
            // (sync_conflicts n-are UNIQUE pe kind,record_id — s-ar aduna unul la fiecare ciclu).
            if (outbox.park(row.seq, row.changeId)) {
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
            }
          }
        }
        // C-4: „superseded” rescrie o fișă locală prin depozitul brut — fila deschisă
        // trebuie să afle, altfel salvează din nou varianta veche (ping-pong cu serverul).
        if (supersededApplied) bumpRevision();
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
      if (supersededApplied) onRecordsChanged(currentRevision());
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
    // C-5: DELETE FROM records e ireversibil — aceeași convenție ca runRevisionTransaction
    // (backupBefore): fără copie, nu continuăm o resincronizare care poate rescrie tot.
    backups.backup('inainte-resincronizare');
    // C-3 aplicat și aici: o editare locală cu conflict parcat își ține varianta doar în
    // `records` (outbox-ul reține payload-ul trimis atunci, nu neapărat pe cel curent) —
    // salvată înainte de DELETE și rescrisă după, ca resincronizarea să nu o piardă.
    const parkedRows = outbox.parked();
    const preserved = parkedRows
      .map(row => ({
        kind: row.kind,
        recordId: row.recordId,
        payload: rawRecordRepository.find(row.kind, row.recordId),
      }))
      .filter(row => row.payload !== undefined);
    const parkedKeys = new Set(parkedRows.map(row => `${row.kind}|${row.recordId}`));
    let count = 0;
    database.exec('BEGIN IMMEDIATE');
    try {
      database.exec('DELETE FROM records');
      // sync_state ținea reviziile filialei vechi; fără resetare, o înregistrare care a
      // dispărut din snapshot ar rămâne cu un base_revision învechit la următoarea editare.
      database.exec('DELETE FROM sync_state');
      for (const kind of Object.keys(snapshot.records)) {
        for (const entry of snapshot.records[kind]) {
          if (parkedKeys.has(`${kind}|${entry.id}`)) continue;
          // applySnapshotEntry (nu normalizeRecord direct): snapshot-ul serverului conține
          // orice KINDS a fost trimis, inclusiv attendance — normalizeRecord ar arunca
          // „Înregistrare invalidă.” pe primul rând de prezență (C-5).
          const applied = applySnapshotEntry({
            rawRecordRepository,
            attendanceRepository,
            poolRepository,
            kind,
            recordId: entry.id,
            payload: entry.payload,
          });
          if (!applied) continue; // sms_templates/settings: Faza 6 (C-8)
          syncState.set(kind, entry.id, {
            serverRevision: entry.revision,
            updatedAt: entry.updatedAt,
            updatedByDevice: '',
            updatedByName: '',
          });
          count += 1;
        }
      }
      for (const row of preserved) rawRecordRepository.save(row.kind, row.payload);
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
          // alt lot, sau rândurile din instantaneul urcat la connect — writeSnapshot le
          // atribuie tot dispozitivului curent) nu se aplică peste ele însele — le-am
          // scris deja local. S-1: fără sync_state aici, prima editare ulterioară a
          // aceleiași fișe pleacă cu baseRevision=0 și devine conflict cu sine (kind-urile
          // CONFLICT_KIND). Scrierea e idempotentă — corectă și la reluarea unui pull.
          if (change.device.id === deviceId) {
            syncState.set(change.kind, change.recordId, {
              serverRevision: change.revision,
              updatedAt: change.changedAt,
              updatedByDevice: change.device.id,
              updatedByName: change.device.name,
            });
            continue;
          }
          // C-3: o fișă cu un conflict nerezolvat (rând parcat) nu se suprascrie la pull —
          // varianta locală rămâne vizibilă până la alegerea utilizatorului (14c); doar
          // capul serverului din conflict și sync_state se actualizează cu ce a mai venit.
          const parked = outbox.findParked(change.kind, change.recordId);
          if (parked) {
            conflicts.updateRemote(parked.seq, {
              payload: change.payload,
              revision: change.revision,
              updatedAt: change.changedAt,
              deviceId: change.device.id,
              deviceName: change.device.name,
            });
            syncState.set(change.kind, change.recordId, {
              serverRevision: change.revision,
              updatedAt: change.changedAt,
              updatedByDevice: change.device.id,
              updatedByName: change.device.name,
            });
            continue;
          }
          if (applier.apply(change)) appliedAny = true;
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
    // Oprit în timpul push-ului (schimbare de filială, închidere): baza poate fi deja închisă.
    if (halted) return;
    await pullOnce();
    if (halted) return;
    await refreshProfile();
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
    // C-9: un 404 (filială neînregistrată), un 410 repetat sau o SyncApplyError ar reveni
    // la fiecare ciclu de 15 s, la nesfârșit, fără backoff — același tratament ca offline-ul.
    scheduleBackoff();
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
          // După stop() baza filialei e închisă sub ciclul în zbor — eroarea e așteptată, nu de raportat.
          if (!halted) handleError(error);
        }
      } while (runAgain && !halted);
    } finally {
      running = false;
      pushing = false;
      if (!halted) notify();
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
    halted = false;
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
    halted = true;
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
