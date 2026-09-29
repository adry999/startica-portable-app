import { TYPES, normalizeRecord } from '#shared/domain/record-schema.mjs';

/**
 * O modificare primită de pe server (push „superseded”/„applied la reluare” sau pull) nu
 * a putut fi înțeleasă de acest calculator — probabil o versiune mai veche a aplicației.
 * Motorul (sync-engine.service.mjs) o prinde separat, ca să oprească pull-ul în loc să
 * pierdă restul lotului dintr-o eroare oarecare.
 */
export class SyncApplyError extends Error {}

/**
 * Interfața minimă folosită mai jos — `createRecordRepository` (`records(kind,id,payload)`,
 * fără nicio tranzacție proprie) o îndeplinește pentru orice kind, nu doar TYPES, deci motorul
 * setului comun (decizia 9, create-common-context.mjs) o trece direct drept
 * `rawRecordRepository`, fără nicio schimbare aici sau în sync-engine.service.mjs.
 * NU `createKindRepository`: `save`/`remove` ale aceluia își deschid singure o tranzacție
 * când sunt apelate direct (bun pentru o rută, rău imbricat în tranzacția motorului —
 * „cannot start a transaction within a transaction”).
 * @typedef {{
 *   find: (kind: string, id: string) => any,
 *   save: (kind: string, record: { id: string }) => unknown,
 *   remove: (kind: string, id: string) => unknown,
 * }} RawKindWriter
 */

// Kind-urile setului comun (Personal 24 — decizia 9, „Changes to the sync plan” din
// 2026-09-27-personal-bazin.md): scrise brut, ca attendance/pool_*, niciodată prin
// normalizeRecord (acela cunoaște doar TYPES, fișele filialei) — motorul setului comun trece
// exact aceeași interfață find/save/remove (createKindRepository, nu createRecordRepository)
// drept `rawRecordRepository`, deci ea funcționează neschimbată mai jos.
export const COMMON_KINDS = /** @type {const} */ ([
  'staff',
  'departments',
  'roles',
  'timesheet',
  'leaves',
  'salaries',
  'advances',
  'salary_payments',
]);

/**
 * @param {RawKindWriter} rawRecordRepository
 * @param {string} kind @param {string} recordId @param {unknown} payload
 * @param {{ normalize?: boolean }} [options] `normalize: false` pentru setul comun (COMMON_KINDS) — plată, fără validare.
 */
function applyRecordEntry(rawRecordRepository, kind, recordId, payload, { normalize = true } = {}) {
  if (payload === null) {
    rawRecordRepository.remove(kind, recordId);
    return;
  }
  if (!normalize) {
    rawRecordRepository.save(kind, /** @type {{ id: string }} */ (payload));
    return;
  }
  let normalized;
  try {
    normalized = normalizeRecord(kind, payload);
  } catch (error) {
    throw new SyncApplyError(`Modificare neînțeleasă (versiune veche?): ${/** @type {Error} */ (error).message}`);
  }
  rawRecordRepository.save(kind, normalized);
}

/**
 * @param {ReturnType<typeof createSyncAttendanceWriter>} attendanceRepository
 * @param {string} recordId `${childId}|${date}` @param {unknown} payload
 */
function applyAttendanceEntry(attendanceRepository, recordId, payload) {
  const [childId, date] = recordId.split('|');
  if (payload === null) attendanceRepository.remove(childId, date);
  else {
    const entry = /** @type {{ status: string, reason?: string, updatedAt: string }} */ (payload);
    attendanceRepository.upsert({
      childId,
      date,
      status: entry.status,
      reason: entry.reason ?? '',
      updatedAt: entry.updatedAt,
    });
  }
}

// Tabelele proprii ale Bazinului (decizia 11, 2026-09-27-personal-bazin.md) — sincronizate
// last-writer-wins, ca attendance, prin `createSyncPoolWriter` mai jos.
const POOL_KINDS = /** @type {const} */ (['pool_bookings', 'pool_sessions', 'pool_closings']);

/**
 * Formă locală, nu importată din `#features/pool` (nicio feature nu importă alt feature) —
 * doar câmpurile efectiv citite de `upsertBooking` mai jos.
 * @typedef {{
 *   id: string, childId: string, coachId: string, weekday: number, time: string,
 *   startDate: string, endDate: string | null, archivedAt: string | null, updatedAt: string,
 * }} SyncPoolBooking
 */

/**
 * @param {ReturnType<typeof createSyncPoolWriter>} poolRepository
 * @param {'pool_bookings' | 'pool_sessions' | 'pool_closings'} kind
 * @param {string} recordId @param {unknown} payload
 */
function applyPoolEntry(poolRepository, kind, recordId, payload) {
  if (kind === 'pool_bookings') {
    if (payload === null) poolRepository.removeBooking(recordId);
    else poolRepository.upsertBooking(/** @type {SyncPoolBooking} */ (payload));
    return;
  }
  if (kind === 'pool_sessions') {
    const [bookingId, date] = recordId.split('|');
    if (payload === null) poolRepository.removeSession(bookingId, date);
    else {
      const session = /** @type {{ status: string, updatedAt: string }} */ (payload);
      poolRepository.upsertSession({ bookingId, date, status: session.status, updatedAt: session.updatedAt });
    }
    return;
  }
  // pool_closings — nu se șterge niciodată (o reînchidere suprascrie), payload mereu nenul.
  const closing = /** @type {{ month: string, closedAt: string }} */ (payload);
  poolRepository.upsertClosing(closing.month, closing.closedAt);
}

/**
 * Scrie o intrare din snapshot-ul serverului (410/resincronizare — C-5) prin depozitul
 * brut potrivit tipului, **fără** audit și **fără** `sync_state` — o resincronizare ține
 * o singură intrare de audit pentru tot lotul (nu una per înregistrare, ca la un pull
 * normal) și scrie `sync_state` separat, doar pentru intrările efectiv aplicate.
 * Evită exact crash-ul C-5: `normalizeRecord` nu mai e apelat pentru tipuri care nu sunt
 * fișe (`attendance`, sau `sms_templates`/`settings` până la Faza 6).
 * @param {{
 *   rawRecordRepository: RawKindWriter,
 *   attendanceRepository: ReturnType<typeof createSyncAttendanceWriter>,
 *   poolRepository?: ReturnType<typeof createSyncPoolWriter>,
 *   kind: string, recordId: string, payload: unknown,
 * }} input
 * @returns {boolean} fals pentru un tip neîntreținut încă (sms_templates/settings)
 */
export function applySnapshotEntry({
  rawRecordRepository,
  attendanceRepository,
  poolRepository,
  kind,
  recordId,
  payload,
}) {
  if (TYPES.includes(kind)) {
    applyRecordEntry(rawRecordRepository, kind, recordId, payload);
    return true;
  }
  if (COMMON_KINDS.includes(/** @type {any} */ (kind))) {
    applyRecordEntry(rawRecordRepository, kind, recordId, payload, { normalize: false });
    return true;
  }
  if (kind === 'attendance') {
    applyAttendanceEntry(attendanceRepository, recordId, payload);
    return true;
  }
  if (poolRepository && POOL_KINDS.includes(/** @type {any} */ (kind))) {
    applyPoolEntry(
      poolRepository,
      /** @type {'pool_bookings' | 'pool_sessions' | 'pool_closings'} */ (kind),
      recordId,
      payload,
    );
    return true;
  }
  return false;
}

/**
 * Scrie prezența primită de pe server direct pe tabelul `attendance`, fără tranzacție
 * proprie (motorul o rulează în interiorul propriei `BEGIN IMMEDIATE`, pe lotul întreg de
 * modificări pull) și fără `onChange` — altfel o modificare venită de pe server s-ar
 * întoarce în propria coadă de sincronizare (decizia 4 din plan: aplicarea modificărilor
 * pull se face mereu prin drumul brut). Nu reused attendance.repository.mjs: acel depozit
 * își gestionează singur `BEGIN IMMEDIATE` per lot, ceea ce nu se poate imbrica.
 * @param {import('node:sqlite').DatabaseSync} database
 */
export function createSyncAttendanceWriter(database) {
  const upsertStatement = database.prepare(
    `INSERT INTO attendance(child_id,date,status,reason,updated_at) VALUES(?,?,?,?,?)
     ON CONFLICT(child_id,date) DO UPDATE SET status=excluded.status,reason=excluded.reason,updated_at=excluded.updated_at`,
  );
  const deleteStatement = database.prepare('DELETE FROM attendance WHERE child_id=? AND date=?');

  return {
    /** @param {{ childId: string, date: string, status: string, reason?: string, updatedAt: string }} entry */
    upsert({ childId, date, status, reason = '', updatedAt }) {
      upsertStatement.run(childId, date, status, reason, updatedAt);
    },
    /** @param {string} childId @param {string} date */
    remove(childId, date) {
      deleteStatement.run(childId, date);
    },
  };
}

/**
 * Scrie datele Bazinului primite de pe server direct pe tabelele proprii, fără tranzacție
 * proprie și fără `onChange` — același motiv ca `createSyncAttendanceWriter`: motorul rulează
 * lotul într-o `BEGIN IMMEDIATE` proprie (nu se poate imbrica) și o modificare venită de pe
 * alt calculator nu trebuie să se întoarcă în propria coadă de trimis.
 * @param {import('node:sqlite').DatabaseSync} database
 */
export function createSyncPoolWriter(database) {
  const upsertBookingStatement = database.prepare(
    `INSERT INTO pool_bookings(id,child_id,coach_id,weekday,time,start_date,end_date,archived_at,updated_at)
     VALUES(?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET child_id=excluded.child_id,coach_id=excluded.coach_id,weekday=excluded.weekday,
       time=excluded.time,start_date=excluded.start_date,end_date=excluded.end_date,archived_at=excluded.archived_at,
       updated_at=excluded.updated_at`,
  );
  const deleteBookingStatement = database.prepare('DELETE FROM pool_bookings WHERE id=?');
  const upsertSessionStatement = database.prepare(
    `INSERT INTO pool_sessions(booking_id,date,status,updated_at) VALUES(?,?,?,?)
     ON CONFLICT(booking_id,date) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at`,
  );
  const deleteSessionStatement = database.prepare('DELETE FROM pool_sessions WHERE booking_id=? AND date=?');
  const upsertClosingStatement = database.prepare(
    `INSERT INTO pool_closings(month,closed_at) VALUES(?,?)
     ON CONFLICT(month) DO UPDATE SET closed_at=excluded.closed_at`,
  );

  return {
    /** @param {SyncPoolBooking} booking */
    upsertBooking(booking) {
      upsertBookingStatement.run(
        booking.id,
        booking.childId,
        booking.coachId,
        booking.weekday,
        booking.time,
        booking.startDate,
        booking.endDate,
        booking.archivedAt,
        booking.updatedAt,
      );
    },
    /** @param {string} id */
    removeBooking(id) {
      deleteBookingStatement.run(id);
    },
    /** @param {{ bookingId: string, date: string, status: string, updatedAt: string }} session */
    upsertSession({ bookingId, date, status, updatedAt }) {
      upsertSessionStatement.run(bookingId, date, status, updatedAt);
    },
    /** @param {string} bookingId @param {string} date */
    removeSession(bookingId, date) {
      deleteSessionStatement.run(bookingId, date);
    },
    /** @param {string} month @param {string} closedAt */
    upsertClosing(month, closedAt) {
      upsertClosingStatement.run(month, closedAt);
    },
  };
}

/**
 * Aplică modificări venite de pe server (pull) sau capul serverului după un push
 * „superseded”/„conflict rezolvat” — mereu prin depozitul brut (rawRecordRepository),
 * niciodată prin cel împachetat cu outbox-ul (decizia 4 din plan): altfel o modificare
 * de pe alt calculator s-ar întoarce în propria coadă de trimis.
 * @param {{
 *   rawRecordRepository: RawKindWriter,
 *   attendanceRepository: ReturnType<typeof createSyncAttendanceWriter>,
 *   poolRepository?: ReturnType<typeof createSyncPoolWriter>,
 *   syncState: ReturnType<typeof import('./sync-state.repository.mjs').createSyncStateRepository>,
 *   auditTrail: import('#shared/contracts/audit-trail.d.mts').AuditTrail,
 * }} dependencies
 */
export function createChangeApplier({
  rawRecordRepository,
  attendanceRepository,
  poolRepository,
  syncState,
  auditTrail,
}) {
  /**
   * O singură modificare, primită de pe server — apelantul o rulează în interiorul unei
   * tranzacții deja deschise (pull-ul întregului lot, sau un push „superseded”/conflict).
   * @param {{
   *   kind: string, recordId: string, payload: unknown, revision: number, changedAt: string,
   *   device: { id: string, name: string },
   * }} change
   * @returns {boolean} fals pentru un tip neîntreținut încă (C-8: sms_templates/settings —
   *   Faza 6 — nu scriu nimic, deci nu au ce audit sau sync_state să lase în urmă)
   */
  function apply({ kind, recordId, payload, revision, changedAt, device }) {
    const isRecordKind = TYPES.includes(kind);
    const isCommonKind = COMMON_KINDS.includes(/** @type {any} */ (kind));
    const isAttendance = kind === 'attendance';
    const isPool = poolRepository && POOL_KINDS.includes(/** @type {any} */ (kind));
    // sms_templates / settings: numele de tip e deja rezervat (KINDS din sync-server/), dar
    // nimeni nu le trimite încă — până la Faza 6, nici audit, nici sync_state (C-8).
    if (!isRecordKind && !isCommonKind && !isAttendance && !isPool) return false;
    const before = isRecordKind || isCommonKind ? (rawRecordRepository.find(kind, recordId) ?? null) : null;
    if (isRecordKind) applyRecordEntry(rawRecordRepository, kind, recordId, payload);
    else if (isCommonKind) applyRecordEntry(rawRecordRepository, kind, recordId, payload, { normalize: false });
    else if (isAttendance) applyAttendanceEntry(attendanceRepository, recordId, payload);
    else applyPoolEntry(/** @type {any} */ (poolRepository), /** @type {any} */ (kind), recordId, payload);
    auditTrail.recordChange({
      action: `sincronizare de pe ${device.name || 'alt calculator'}`,
      recordType: isRecordKind ? /** @type {import('#shared/contracts/record-types.mjs').RecordType} */ (kind) : null,
      recordId,
      before,
      after: payload,
    });
    syncState.set(kind, recordId, {
      serverRevision: revision,
      updatedAt: changedAt,
      updatedByDevice: device.id,
      updatedByName: device.name,
    });
    return true;
  }

  return { apply };
}
