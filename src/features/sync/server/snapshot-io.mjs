import { TYPES } from '#shared/domain/record-schema.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { createKindRepository } from '#core/server/persistence/kind-repository.mjs';
import { createSyncStateRepository } from './sync-state.repository.mjs';
import { createSettingsRepository } from '#core/server/settings/settings-repository.mjs';
import {
  COMMON_KINDS,
  applySnapshotEntry,
  createSyncAttendanceWriter,
  createSyncPoolWriter,
} from './change-applier.mjs';

const SYNC_SINCE_SETTING = 'sync.since';

/**
 * B-2: prezența și bazinul au tabele proprii (`attendance`, `pool_bookings`/`pool_sessions`/
 * `pool_closings`), nu `records(kind,id,payload)` — citite direct aici, cu exact aceleași
 * id-uri și forme de payload pe care le produce onChange-ul depozitelor lor (outbox-ul), ca
 * applySnapshotEntry de pe partea care descarcă acest snapshot să le recunoască neschimbat.
 * @param {import('node:sqlite').DatabaseSync} database
 * @returns {{ kind: string, id: string, payload: unknown, updatedAt: string }[]}
 */
function readAttendanceAndPoolEntries(database) {
  /** @type {{ kind: string, id: string, payload: unknown, updatedAt: string }[]} */
  const entries = [];
  for (const row of database
    .prepare('SELECT child_id,date,status,reason,updated_at FROM attendance ORDER BY child_id,date')
    .all()) {
    entries.push({
      kind: 'attendance',
      id: `${row.child_id}|${row.date}`,
      payload: {
        childId: row.child_id,
        date: row.date,
        status: row.status,
        reason: row.reason,
        updatedAt: row.updated_at,
      },
      updatedAt: /** @type {string} */ (row.updated_at),
    });
  }
  for (const row of database
    .prepare(
      'SELECT id,child_id,coach_id,weekday,time,start_date,end_date,archived_at,updated_at FROM pool_bookings ORDER BY id',
    )
    .all()) {
    entries.push({
      kind: 'pool_bookings',
      id: /** @type {string} */ (row.id),
      payload: {
        id: row.id,
        childId: row.child_id,
        coachId: row.coach_id,
        weekday: row.weekday,
        time: row.time,
        startDate: row.start_date,
        endDate: row.end_date,
        archivedAt: row.archived_at,
        updatedAt: row.updated_at,
      },
      updatedAt: /** @type {string} */ (row.updated_at),
    });
  }
  for (const row of database
    .prepare('SELECT booking_id,date,status,updated_at FROM pool_sessions ORDER BY booking_id,date')
    .all()) {
    entries.push({
      kind: 'pool_sessions',
      id: `${row.booking_id}|${row.date}`,
      payload: { bookingId: row.booking_id, date: row.date, status: row.status, updatedAt: row.updated_at },
      updatedAt: /** @type {string} */ (row.updated_at),
    });
  }
  for (const row of database.prepare('SELECT month,closed_at FROM pool_closings ORDER BY month').all()) {
    entries.push({
      kind: 'pool_closings',
      id: /** @type {string} */ (row.month),
      payload: { month: row.month, closedAt: row.closed_at },
      updatedAt: /** @type {string} */ (row.closed_at),
    });
  }
  return entries;
}

/**
 * Prima încărcare a unei filiale cu date (Task 11, decizia 9): toată evidența, plată,
 * ca `entries` pentru `POST /v1/branches/:id/snapshot`. Fără `sync_state` local încă —
 * fiecare rând devine revizia 1 pe server (`writeSnapshot`), deci un singur `updatedAt`
 * (momentul încărcării) e suficient; nu există o valoare „ultima schimbare” mai bună de
 * atât pentru înregistrări create înainte ca sincronizarea să existe.
 * B-2: prezența și bazinul (tabele proprii, nu TYPES) au propriul `updatedAt` real per rând —
 * folosit direct, nu `now()`, ca istoricul din `readAttendanceAndPoolEntries` să nu se piardă.
 * @param {import('node:sqlite').DatabaseSync} database
 * @param {{ now: () => Date }} dependencies
 */
export function readLocalSnapshot(database, { now }) {
  const raw = createRecordRepository(database);
  const state = raw.readSnapshot();
  const updatedAt = now().toISOString();
  /** @type {{ kind: string, id: string, payload: unknown, updatedAt: string }[]} */
  const entries = [];
  for (const kind of TYPES) {
    for (const record of state[kind] ?? []) entries.push({ kind, id: record.id, payload: record, updatedAt });
  }
  entries.push(...readAttendanceAndPoolEntries(database));
  return { entries };
}

/**
 * Descărcarea unei filiale noi (Task 11): scrie brut fiecare cap primit (fără outbox —
 * exact ce a spus serverul e adevărul de plecare) și `sync_state`-ul lui, apoi cursorul
 * `sync.since = headSeq`, ca motorul pornit ulterior să continue de acolo, nu de la 0.
 * B-1: snapshot-ul serverului conține orice KIND a fost trimis de filială, inclusiv
 * `attendance`/`pool_*` — `raw.save` (records(kind,id,payload), cu `id` obligatoriu) arunca
 * pentru ele. Fiecare intrare trece acum prin `applySnapshotEntry`, exact ca resincronizarea
 * la 410 din `sync-engine.service.mjs` — același `attendanceRepository`/`poolRepository`,
 * construite pe aceeași bază. `applied === false` (sms_templates/settings, Faza 6, C-8) nu
 * lasă `sync_state` în urmă, la fel ca la 410.
 * @param {import('node:sqlite').DatabaseSync} database
 * @param {{ records: Record<string, { id: string, revision: number, payload: unknown, updatedAt: string }[]>, headSeq: number }} snapshot
 */
export function writeLocalSnapshot(database, { records, headSeq }) {
  const raw = createRecordRepository(database);
  const attendanceRepository = createSyncAttendanceWriter(database);
  const poolRepository = createSyncPoolWriter(database);
  const syncState = createSyncStateRepository(database);
  const settings = createSettingsRepository(database);

  database.exec('BEGIN IMMEDIATE');
  try {
    for (const [kind, rows] of Object.entries(records)) {
      for (const row of rows) {
        const applied = applySnapshotEntry({
          rawRecordRepository: raw,
          attendanceRepository,
          poolRepository,
          kind,
          recordId: row.id,
          payload: row.payload,
        });
        if (!applied) continue;
        syncState.set(kind, row.id, {
          serverRevision: row.revision,
          updatedAt: row.updatedAt,
          updatedByDevice: '',
          updatedByName: '',
        });
      }
    }
    settings.setSetting(SYNC_SINCE_SETTING, String(headSeq));
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

/**
 * Aceeași pereche, pentru setul comun (Personal 24, decizia 9): `entries` prin
 * `createKindRepository`, nu `createRecordRepository` — kind-urile lui nu sunt în TYPES.
 * Folosită doar de sync-connect.service.mjs la connect(), când serverul nu are încă
 * niciun rând pentru `comun` (dataset gol) sau invers (setul local e gol).
 * @param {import('node:sqlite').DatabaseSync} database
 * @param {{ now: () => Date }} dependencies
 */
export function readCommonSnapshot(database, { now }) {
  const kinds = createKindRepository(database);
  const updatedAt = now().toISOString();
  /** @type {{ kind: string, id: string, payload: unknown, updatedAt: string }[]} */
  const entries = [];
  for (const kind of COMMON_KINDS) {
    for (const record of kinds.list(kind)) entries.push({ kind, id: record.id, payload: record, updatedAt });
  }
  return { entries };
}

/**
 * @param {import('node:sqlite').DatabaseSync} database
 * @param {{ records: Record<string, { id: string, revision: number, payload: unknown, updatedAt: string }[]>, headSeq: number }} snapshot
 */
export function writeCommonSnapshot(database, { records, headSeq }) {
  // Fără onChange: exact ce a spus serverul e adevărul de plecare — nu are voie să se
  // întoarcă în propria coadă de trimis (decizia 4 din plan, ca writeLocalSnapshot mai sus).
  // kinds.transaction(...), nu un BEGIN IMMEDIATE brut: save() al lui createKindRepository
  // își deschide singur o tranzacție dacă nu una e deja marcată pe ACEEAȘI instanță — un
  // BEGIN brut în jur, fără să treacă prin transaction(), ar arunca „cannot start a
  // transaction within a transaction” la primul kinds.save() de mai jos.
  const kinds = createKindRepository(database);
  const syncState = createSyncStateRepository(database);
  const settings = createSettingsRepository(database);

  kinds.transaction(() => {
    for (const [kind, rows] of Object.entries(records)) {
      for (const row of rows) {
        if (row.payload !== null) kinds.save(kind, /** @type {{ id: string }} */ (row.payload));
        syncState.set(kind, row.id, {
          serverRevision: row.revision,
          updatedAt: row.updatedAt,
          updatedByDevice: '',
          updatedByName: '',
        });
      }
    }
    settings.setSetting(SYNC_SINCE_SETTING, String(headSeq));
  });
}
