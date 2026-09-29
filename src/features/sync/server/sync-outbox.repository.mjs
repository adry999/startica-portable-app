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
  // B-3: caută orice rând ne-terminal (pending SAU parcat) pentru aceeași fișă — nu doar
  // pending. O fișă parcată (conflict nerezolvat) care mai primește o editare locală
  // trebuie să-și actualizeze payload-ul pe LOC, nu să primească un al doilea rând pending:
  // indexul unic (kind,record_id) WHERE status='pending' nu ar opri inserarea (rândul vechi
  // e 'parked', nu 'pending'), dar `unpark()` de la rezolvarea conflictului ar lovi apoi
  // UNIQUE constraint, pentru că rândul nou ar fi deja pending.
  const findActiveStatement = database.prepare(
    "SELECT seq,base_revision,payload FROM sync_outbox WHERE kind=? AND record_id=? AND status IN ('pending','parked')",
  );
  const findServerRevisionStatement = database.prepare('SELECT server_revision FROM sync_state WHERE kind=? AND id=?');
  const insertStatement = database.prepare(
    "INSERT INTO sync_outbox(change_id,kind,record_id,base_revision,payload,created_at,status) VALUES(?,?,?,?,?,?,'pending')",
  );
  const updateExistingStatement = database.prepare(
    'UPDATE sync_outbox SET change_id=?,payload=?,created_at=? WHERE seq=?',
  );
  const pendingStatement = database.prepare("SELECT * FROM sync_outbox WHERE status='pending' ORDER BY seq LIMIT ?");
  const parkedStatement = database.prepare("SELECT * FROM sync_outbox WHERE status='parked' ORDER BY seq");
  const findParkedStatement = database.prepare(
    "SELECT * FROM sync_outbox WHERE kind=? AND record_id=? AND status='parked'",
  );
  const findPendingStatement = database.prepare(
    "SELECT * FROM sync_outbox WHERE kind=? AND record_id=? AND status='pending'",
  );
  const countPendingStatement = database.prepare("SELECT COUNT(*) AS count FROM sync_outbox WHERE status='pending'");
  const markSentStatement = database.prepare("UPDATE sync_outbox SET status='sent' WHERE seq=?");
  // C-1: parcarea/ștergerea unui rând se face doar dacă change_id încă e cel trimis la
  // server — o a doua modificare locală, apărută cât timp push-ul era în zbor, a actualizat
  // deja rândul (coalesceOutboxChange) cu un change_id nou; fără această gardă, „applied”
  // sau „conflict” pentru payload-ul vechi ar șterge/parca payload-ul nou, nevăzut de server.
  const parkStatement = database.prepare("UPDATE sync_outbox SET status='parked' WHERE seq=? AND change_id=?");
  const unparkStatement = database.prepare("UPDATE sync_outbox SET status='pending',base_revision=? WHERE seq=?");
  const unparkWithPayloadStatement = database.prepare(
    "UPDATE sync_outbox SET status='pending',base_revision=?,payload=? WHERE seq=?",
  );
  const removeStatement = database.prepare('DELETE FROM sync_outbox WHERE seq=? AND change_id=?');

  /**
   * @param {{ kind: string, recordId: string, payload: unknown | null }} change
   */
  function enqueue({ kind, recordId, payload }) {
    const existingRow = findActiveStatement.get(kind, recordId);
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
      // Actualizează rândul în starea lui curentă (pending rămâne pending, parcat rămâne
      // parcat) — nu-i schimbă statusul.
      updateExistingStatement.run(
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

  /** Rândurile cu un conflict nerezolvat (14c) — folosite la 410/resincronizare (C-5) și la pull (C-3). */
  function parked() {
    return parkedStatement.all().map(toChange);
  }

  /** @param {string} kind @param {string} recordId */
  function findParked(kind, recordId) {
    const row = findParkedStatement.get(kind, recordId);
    return row ? toChange(row) : undefined;
  }

  /**
   * B-3: la rezolvarea unui conflict cu „varianta de pe alt calculator”, un rând încă
   * pending pentru aceeași fișă (o editare locală de care conflictul nu știa) trebuie
   * șters — altfel pleacă la următorul push cu o revizie de bază depășită și redeschide
   * conflictul chiar împotriva variantei tocmai acceptate.
   * @param {string} kind @param {string} recordId
   */
  function findPending(kind, recordId) {
    const row = findPendingStatement.get(kind, recordId);
    return row ? toChange(row) : undefined;
  }

  function countPending() {
    return /** @type {{ count: number }} */ (countPendingStatement.get()).count;
  }

  /** @param {number[]} seqs */
  function markSent(seqs) {
    for (const seq of seqs) markSentStatement.run(seq);
  }

  /**
   * @param {number} seq @param {string} changeId
   * @returns {boolean} fals dacă rândul a fost deja coalescat cu o modificare mai nouă (change_id diferit)
   */
  function park(seq, changeId) {
    return parkStatement.run(seq, changeId).changes > 0;
  }

  /**
   * @param {number} seq @param {number} baseRevision
   * @param {unknown} [payload] B-3: fișa curentă de retrimis, când e cunoscută (rezolvarea
   *   unui conflict cu „varianta locală” trebuie să trimită fișa așa cum e acum, nu payload-ul
   *   din momentul conflictului). Omis — păstrează payload-ul rândului (comportamentul vechi).
   */
  function unpark(seq, baseRevision, payload) {
    if (payload === undefined) unparkStatement.run(baseRevision, seq);
    else unparkWithPayloadStatement.run(baseRevision, payload === null ? null : JSON.stringify(payload), seq);
  }

  /**
   * @param {number} seq @param {string} changeId
   * @returns {boolean} fals dacă rândul a fost deja coalescat cu o modificare mai nouă (change_id diferit)
   */
  function remove(seq, changeId) {
    return removeStatement.run(seq, changeId).changes > 0;
  }

  return { enqueue, pending, parked, findParked, findPending, countPending, markSent, park, unpark, remove };
}
