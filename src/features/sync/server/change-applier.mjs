import { TYPES, normalizeRecord } from '#shared/domain/record-schema.mjs';

/**
 * O modificare primită de pe server (push „superseded”/„applied la reluare” sau pull) nu
 * a putut fi înțeleasă de acest calculator — probabil o versiune mai veche a aplicației.
 * Motorul (sync-engine.service.mjs) o prinde separat, ca să oprească pull-ul în loc să
 * pierdă restul lotului dintr-o eroare oarecare.
 */
export class SyncApplyError extends Error {}

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
 * Aplică modificări venite de pe server (pull) sau capul serverului după un push
 * „superseded”/„conflict rezolvat” — mereu prin depozitul brut (rawRecordRepository),
 * niciodată prin cel împachetat cu outbox-ul (decizia 4 din plan): altfel o modificare
 * de pe alt calculator s-ar întoarce în propria coadă de trimis.
 * @param {{
 *   rawRecordRepository: ReturnType<typeof import('#core/server/persistence/record-repository.mjs').createRecordRepository>,
 *   attendanceRepository: ReturnType<typeof createSyncAttendanceWriter>,
 *   syncState: ReturnType<typeof import('./sync-state.repository.mjs').createSyncStateRepository>,
 *   auditTrail: import('#shared/contracts/audit-trail.d.mts').AuditTrail,
 * }} dependencies
 */
export function createChangeApplier({ rawRecordRepository, attendanceRepository, syncState, auditTrail }) {
  /** @param {string} kind @param {string} recordId @param {unknown} payload */
  function applyRecord(kind, recordId, payload) {
    if (payload === null) {
      rawRecordRepository.remove(kind, recordId);
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

  /** @param {string} recordId `${childId}|${date}` @param {unknown} payload */
  function applyAttendance(recordId, payload) {
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

  /**
   * O singură modificare, primită de pe server — apelantul o rulează în interiorul unei
   * tranzacții deja deschise (pull-ul întregului lot, sau un push „superseded”/conflict).
   * @param {{
   *   kind: string, recordId: string, payload: unknown, revision: number, changedAt: string,
   *   device: { id: string, name: string },
   * }} change
   */
  function apply({ kind, recordId, payload, revision, changedAt, device }) {
    const isRecordKind = TYPES.includes(kind);
    const before = isRecordKind ? (rawRecordRepository.find(kind, recordId) ?? null) : null;
    if (isRecordKind) applyRecord(kind, recordId, payload);
    else if (kind === 'attendance') applyAttendance(recordId, payload);
    // sms_templates / settings: Faza 6 le tratează efectiv — aici numele de tip e deja
    // rezervat (KINDS din sync-server/), dar nimeni nu le trimite încă, deci nimic de aplicat.
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
  }

  return { apply };
}
