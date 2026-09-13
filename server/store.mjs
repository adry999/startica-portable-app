// Fațadă păstrată pentru compatibilitate; persistența și tranzacția cu revizie
// sunt în src/core/server, iar istoricul în src/features/audit-log.
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { createRevisionTransaction } from '#core/server/persistence/revision-transaction.mjs';
import { createAuditLogRepository } from '#features/audit-log/index.server.mjs';

export function createStore({ db, backups }) {
  const recordRepository = createRecordRepository(db);
  const auditLogRepository = createAuditLogRepository(db);

  // Adaptor pentru rutele încă nemigrate.
  const audit = (action, recordType, recordId, before, after) =>
    auditLogRepository.recordChange({ action, recordType, recordId, before, after });

  const { runRevisionTransaction, replaceAllRecords } = createRevisionTransaction({
    database: db,
    recordRepository,
    backups,
    auditTrail: auditLogRepository,
  });

  const commit = (body, action, fn, preBackup = false) =>
    runRevisionTransaction(body, { action, backupBefore: preBackup }, fn);

  return {
    recordRepository,
    runRevisionTransaction,
    readState: recordRepository.readSnapshot,
    envelope: recordRepository.readEnvelope,
    currentRevision: recordRepository.currentRevision,
    readRecord: recordRepository.find,
    recordExists: recordRepository.exists,
    writeRecord: recordRepository.save,
    deleteRecord: recordRepository.remove,
    audit,
    auditLogRepository,
    commit,
    replace: replaceAllRecords,
  };
}
