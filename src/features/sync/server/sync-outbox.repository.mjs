import { randomUUID } from 'node:crypto';
import { coalesceOutboxChange } from '../domain/change-coalescing.mjs';

/** @param {any} row */
function toChange(row) {
  return {
    seq: row.seq,
    changeId: row.change_id,
    kind: row.kind,
    recordId: row.record_id,
    baseRevision: row.base_revision,
    payload: row.payload === null ? null : JSON.parse(row.payload),
    createdAt: row.created_at,
    status: row.status,
  };
}

/**
 * Coada locală de modificări netrimise (`sync_outbox`), capturate de
 * outbox-recording-repository.mjs în aceeași tranzacție cu scrierea
 * înregistrării — vezi decizia 4 din plan.
 * @param {import('node:sqlite').DatabaseSync} database
 * @param {{ now?: () => Date }} [options]
 */
export function createSyncOutboxRepository(database, { now = () => new Date() } = {}) {
  const findPendingStatement = database.prepare(
    "SELECT seq,base_revision,payload FROM sync_outbox WHERE kind=? AND record_id=? AND status='pending'",
  );
  const findServerRevisionStatement = database.prepare('SELECT server_revision FROM sync_state WHERE kind=? AND id=?');
  const insertStatement = database.prepare(
    "INSERT INTO sync_outbox(change_id,kind,record_id,base_revision,payload,created_at,status) VALUES(?,?,?,?,?,?,'pending')",
  );
  const updatePendingStatement = database.prepare(
    'UPDATE sync_outbox SET change_id=?,payload=?,created_at=? WHERE seq=?',
  );
  const pendingStatement = database.prepare("SELECT * FROM sync_outbox WHERE status='pending' ORDER BY seq LIMIT ?");
  const countPendingStatement = database.prepare("SELECT COUNT(*) AS count FROM sync_outbox WHERE status='pending'");
  const markSentStatement = database.prepare("UPDATE sync_outbox SET status='sent' WHERE seq=?");
  const parkStatement = database.prepare("UPDATE sync_outbox SET status='parked' WHERE seq=?");
  const unparkStatement = database.prepare("UPDATE sync_outbox SET status='pending',base_revision=? WHERE seq=?");
  const removeStatement = database.prepare('DELETE FROM sync_outbox WHERE seq=?');

  /**
   * @param {{ kind: string, recordId: string, payload: unknown | null }} change
   */
  function enqueue({ kind, recordId, payload }) {
    const existingRow = findPendingStatement.get(kind, recordId);
    const serverRevisionRow = /** @type {{ server_revision: number } | undefined} */ (
      findServerRevisionStatement.get(kind, recordId)
    );
    const incomingBaseRevision = serverRevisionRow ? serverRevisionRow.server_revision : 0;
    const serializedIncoming = payload === null ? null : JSON.stringify(payload);
    const coalesced = coalesceOutboxChange(
      existingRow
        ? {
            baseRevision: /** @type {{ base_revision: number }} */ (existingRow).base_revision,
            payload: /** @type {{ payload: string | null }} */ (existingRow).payload,
          }
        : undefined,
      { baseRevision: incomingBaseRevision, payload: serializedIncoming },
    );
    const nowIso = now().toISOString();
    const coalescedPayload = /** @type {string | null} */ (coalesced.payload);
    if (existingRow)
      updatePendingStatement.run(
        randomUUID(),
        coalescedPayload,
        nowIso,
        /** @type {{ seq: number }} */ (existingRow).seq,
      );
    else insertStatement.run(randomUUID(), kind, recordId, coalesced.baseRevision, coalescedPayload, nowIso);
  }

  /** @param {number} [limit] */
  function pending(limit = 200) {
    return pendingStatement.all(limit).map(toChange);
  }

  function countPending() {
    return /** @type {{ count: number }} */ (countPendingStatement.get()).count;
  }

  /** @param {number[]} seqs */
  function markSent(seqs) {
    for (const seq of seqs) markSentStatement.run(seq);
  }

  /** @param {number} seq */
  function park(seq) {
    parkStatement.run(seq);
  }

  /** @param {number} seq @param {number} baseRevision */
  function unpark(seq, baseRevision) {
    unparkStatement.run(baseRevision, seq);
  }

  /** @param {number} seq */
  function remove(seq) {
    removeStatement.run(seq);
  }

  return { enqueue, pending, countPending, markSent, park, unpark, remove };
}
