import { TYPES } from '#shared/domain/record-schema.mjs';
import { fail } from '../errors/domain-error.mjs';
import { sha256Hex } from './content-digest.mjs';

const REQUEST_ID = /^[a-zA-Z0-9-]{10,100}$/;
// requests ține idempotența pentru cazul unei reluări după o cădere de rețea:
// nu are nevoie să crească la nesfârșit, deci se rărește la fiecare scriere.
const REQUEST_RETENTION = 1000;

/**
 * @typedef {{
 *   ok: true,
 *   state: ReturnType<typeof import('#shared/domain/record-schema.mjs').emptyState>,
 *   revision: number,
 *   updatedAt: string,
 *   replayed?: true,
 *   warning?: string,
 *   health: unknown,
 * }} RevisionEnvelope
 */

/**
 * @param {{
 *   database: import('node:sqlite').DatabaseSync,
 *   recordRepository: ReturnType<typeof import('./record-repository.mjs').createRecordRepository>,
 *   backups: { backup: (reason?: string) => unknown, autoBackup: () => { warning?: string }, health: () => unknown },
 *   auditTrail: import('#shared/contracts/audit-trail.mjs').AuditTrail,
 * }} dependencies
 */
export function createRevisionTransaction({ database, recordRepository, backups, auditTrail }) {
  // Orice modificare trece pe aici. Trei garanții:
  //  - idempotență: același requestId întoarce rezultatul anterior, deci o
  //    cerere reluată după o cădere de rețea nu produce o a doua înregistrare;
  //  - revizia cerută de client este verificată și în interiorul tranzacției,
  //    ca o a doua filă să nu suprascrie o modificare pe care nu a văzut-o;
  //  - backupBefore pentru operațiunile ireversibile, înainte de a atinge datele.
  /** @returns {RevisionEnvelope} */
  function runRevisionTransaction(request, { action, backupBefore = false }, applyChanges) {
    if (typeof request.requestId !== 'string' || !REQUEST_ID.test(request.requestId))
      fail('Identificator de operațiune invalid.');
    const digest = sha256Hex(JSON.stringify({ action, ...request }));
    const prior = database.prepare('SELECT * FROM requests WHERE id=?').get(request.requestId);
    if (prior) {
      if (prior.digest !== digest) fail('Operațiunea a fost deja folosită cu alte date.', 409);
      return { ok: true, replayed: true, ...recordRepository.readEnvelope(), health: backups.health() };
    }
    if (request.revision !== recordRepository.currentRevision())
      fail(
        'Datele au fost schimbate în altă filă. Reîncarcă datele și verifică formularul înainte să salvezi din nou.',
        409,
      );
    if (backupBefore)
      try {
        backups.backup('inainte-' + action);
      } catch (e) {
        // Singura eroare de sistem pe care operatorul o poate repara singur; mesaj specific, nu generic.
        console.error(/** @type {Error} */ (e).stack || e);
        fail(
          'Backupul de siguranță dinaintea operației nu a putut fi creat; nu s-a modificat nimic. Verifică folderul de backup și spațiul pe disc.',
          500,
        );
      }
    database.exec('BEGIN IMMEDIATE');
    try {
      if (request.revision !== recordRepository.currentRevision()) fail('Date modificate în altă filă.', 409);
      applyChanges();
      database.prepare('UPDATE meta SET revision=revision+1,updated_at=? WHERE id=1').run(new Date().toISOString());
      database.prepare('INSERT INTO requests VALUES(?,?,?)').run(request.requestId, digest, request.revision + 1);
      database.prepare('DELETE FROM requests WHERE revision<?').run(request.revision + 1 - REQUEST_RETENTION);
      database.exec('COMMIT');
    } catch (e) {
      database.exec('ROLLBACK');
      throw e;
    }
    const backupResult = backups.autoBackup();
    return {
      ok: true,
      ...recordRepository.readEnvelope(),
      warning: backupResult.warning || '',
      health: backups.health(),
    };
  }

  // Înlocuiește toată evidența (import sau restaurare), consemnând în jurnal
  // fiecare înregistrare care chiar diferă.
  function replaceAllRecords(snapshot, action) {
    const before = recordRepository.readSnapshot();
    database.exec('DELETE FROM records');
    for (const type of TYPES) {
      for (const record of snapshot[type]) recordRepository.save(type, record);
      const previousById = new Map(before[type].map(record => [record.id, record]));
      const nextById = new Map(snapshot[type].map(record => [record.id, record]));
      for (const id of new Set([...previousById.keys(), ...nextById.keys()]))
        if (JSON.stringify(previousById.get(id)) !== JSON.stringify(nextById.get(id)))
          auditTrail.recordChange({
            action,
            recordType: /** @type {import('#shared/contracts/record-types.mjs').RecordType} */ (type),
            recordId: id,
            before: previousById.get(id),
            after: nextById.get(id),
          });
    }
  }

  return { runRevisionTransaction, replaceAllRecords };
}
