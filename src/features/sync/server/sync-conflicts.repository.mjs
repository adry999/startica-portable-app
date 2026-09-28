import { randomUUID } from 'node:crypto';

/** @param {any} row */
function toEntry(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    kind: row.kind,
    recordId: row.record_id,
    localPayload: row.local_payload === null ? null : JSON.parse(row.local_payload),
    localUpdatedAt: row.local_updated_at,
    remotePayload: row.remote_payload === null ? null : JSON.parse(row.remote_payload),
    remoteRevision: row.remote_revision,
    remoteUpdatedAt: row.remote_updated_at,
    remoteDeviceId: row.remote_device_id,
    remoteDeviceName: row.remote_device_name,
    createdAt: row.created_at,
    outboxSeq: row.outbox_seq,
  };
}

/**
 * Conflictele de editare parcate (14c) — ambele variante, ca alegerea
 * utilizatorului să nu piardă niciuna (decizia 8 din plan).
 * @param {import('node:sqlite').DatabaseSync} database
 * @param {{ now?: () => Date }} [options]
 */
export function createSyncConflictsRepository(database, { now = () => new Date() } = {}) {
  const insertStatement = database.prepare(
    `INSERT INTO sync_conflicts(id,kind,record_id,local_payload,local_updated_at,remote_payload,remote_revision,
       remote_updated_at,remote_device_id,remote_device_name,created_at,outbox_seq) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const listStatement = database.prepare('SELECT * FROM sync_conflicts ORDER BY created_at');
  const findStatement = database.prepare('SELECT * FROM sync_conflicts WHERE id=?');
  const removeStatement = database.prepare('DELETE FROM sync_conflicts WHERE id=?');
  const countStatement = database.prepare('SELECT COUNT(*) AS count FROM sync_conflicts');
  const updateRemoteStatement = database.prepare(
    `UPDATE sync_conflicts SET remote_payload=?,remote_revision=?,remote_updated_at=?,remote_device_id=?,
       remote_device_name=? WHERE outbox_seq=?`,
  );

  /**
   * @param {{
   *   kind: string, recordId: string,
   *   localPayload: unknown | null, localUpdatedAt: string,
   *   remotePayload: unknown | null, remoteRevision: number, remoteUpdatedAt: string,
   *   remoteDeviceId: string, remoteDeviceName: string, outboxSeq: number | null,
   * }} conflict
   * @returns {string} id-ul conflictului creat
   */
  function insert(conflict) {
    const id = randomUUID();
    insertStatement.run(
      id,
      conflict.kind,
      conflict.recordId,
      conflict.localPayload === null ? null : JSON.stringify(conflict.localPayload),
      conflict.localUpdatedAt,
      conflict.remotePayload === null ? null : JSON.stringify(conflict.remotePayload),
      conflict.remoteRevision,
      conflict.remoteUpdatedAt,
      conflict.remoteDeviceId,
      conflict.remoteDeviceName,
      now().toISOString(),
      conflict.outboxSeq,
    );
    return id;
  }

  function list() {
    return listStatement.all().map(toEntry);
  }

  /** @param {string} id */
  function find(id) {
    return toEntry(findStatement.get(id));
  }

  /** @param {string} id */
  function remove(id) {
    removeStatement.run(id);
  }

  function count() {
    return /** @type {{ count: number }} */ (countStatement.get()).count;
  }

  /**
   * C-3: pull-ul nu suprascrie o fișă cu conflict parcat, dar capul serverului poate
   * avansa în continuare (a treia modificare, de pe alt calculator) — conflictul trebuie
   * să arate mereu ultima variantă remote, nu doar prima văzută.
   * @param {number} outboxSeq
   * @param {{ payload: unknown | null, revision: number, updatedAt: string, deviceId: string, deviceName: string }} remote
   */
  function updateRemote(outboxSeq, remote) {
    updateRemoteStatement.run(
      remote.payload === null ? null : JSON.stringify(remote.payload),
      remote.revision,
      remote.updatedAt,
      remote.deviceId,
      remote.deviceName,
      outboxSeq,
    );
  }

  return { insert, list, find, remove, count, updateRemote };
}
