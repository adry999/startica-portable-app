// Fațadă păstrată pentru compatibilitate; persistența și tranzacția cu revizie
// s-au mutat în src/core/server (pasul 4 din plan). Jurnalul de audit rămâne
// aici până la pasul 6, când feature-ul audit-log preia și el.
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { createRevisionTransaction } from '#core/server/persistence/revision-transaction.mjs';

export function createStore({ db, backups }) {
  const recordRepository = createRecordRepository(db);

  function audit(action, type, id, before, after) {
    db.prepare(
      'INSERT INTO audit_changes(created_at,action,kind,record_id,before_json,after_json) VALUES(?,?,?,?,?,?)',
    ).run(
      new Date().toISOString(),
      action,
      type,
      id,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
    );
  }

  const auditPage = offset => db.prepare('SELECT * FROM audit_changes ORDER BY id DESC LIMIT 100 OFFSET ?').all(offset);

  const auditTrail = {
    recordChange: ({ action, recordType, recordId, before, after }) =>
      audit(action, recordType, recordId, before, after),
  };

  const { runRevisionTransaction, replaceAllRecords } = createRevisionTransaction({
    database: db,
    recordRepository,
    backups,
    auditTrail,
  });

  const commit = (body, action, fn, preBackup = false) =>
    runRevisionTransaction(body, { action, backupBefore: preBackup }, fn);

  return {
    readState: recordRepository.readSnapshot,
    envelope: recordRepository.readEnvelope,
    currentRevision: recordRepository.currentRevision,
    readRecord: recordRepository.find,
    recordExists: recordRepository.exists,
    writeRecord: recordRepository.save,
    deleteRecord: recordRepository.remove,
    audit,
    auditPage,
    commit,
    replace: replaceAllRecords,
  };
}
