import { randomUUID } from 'node:crypto';
import { fail } from './router.mjs';
import { isLastWriterWins } from './change-policy.mjs';
import { readMeta } from './backup.service.mjs';

/** @typedef {{ branch_id: string, kind: string, id: string, revision: number, payload: string | null, updated_at: string, updated_by: string }} HeadRow */
/** @typedef {{ seq: number, change_id: string, branch_id: string, kind: string, record_id: string, revision: number, payload: string | null, changed_at: string, received_at: string, device_id: string, result: string }} ChangeRow */
/** @typedef {{ changeId: string, kind: string, recordId: string, baseRevision: number, payload: unknown, changedAt: string }} IncomingChange */
/** @typedef {{ payload: unknown, revision: number, updatedAt: string, updatedBy: { id: string, name: string } }} HeadView */
/** @typedef {{ changeId: string, status: string, revision: number, head?: HeadView }} PushResult */

/**
 * Nucleul politicii de sincronizare (decizia 5): o revizie curentă se aplică; una
 * depășită e conflict pentru fișe/grupe/categorii/vizite și last-writer-wins pentru
 * restul; un `changeId` reluat întoarce rezultatul memorat, fără a scrie a doua oară.
 * @param {{ database: import('node:sqlite').DatabaseSync, devices: ReturnType<typeof import('./devices.repository.mjs').createDevicesRepository> }} dependencies
 */
export function createChangesService({ database, devices }) {
  /** @param {string} branchId @param {string} kind @param {string} recordId @returns {HeadRow | undefined} */
  function findHeadRow(branchId, kind, recordId) {
    return /** @type {HeadRow | undefined} */ (
      database.prepare('SELECT * FROM records WHERE branch_id=? AND kind=? AND id=?').get(branchId, kind, recordId)
    );
  }

  /** @param {HeadRow} row @returns {HeadView} */
  function toHeadView(row) {
    const author = devices.findById(row.updated_by);
    return {
      payload: row.payload === null ? null : JSON.parse(row.payload),
      revision: row.revision,
      updatedAt: row.updated_at,
      updatedBy: { id: row.updated_by, name: author?.name ?? '' },
    };
  }

  /** @param {string} changeId @returns {ChangeRow | undefined} */
  function findStoredChange(changeId) {
    return /** @type {ChangeRow | undefined} */ (
      database.prepare('SELECT * FROM changes WHERE change_id=?').get(changeId)
    );
  }

  /** @param {{ changeId: string, branchId: string, kind: string, recordId: string, revision: number, payload: unknown, changedAt: string, deviceId: string, result: string, receivedAt: string }} input */
  function insertChangeRow({
    changeId,
    branchId,
    kind,
    recordId,
    revision,
    payload,
    changedAt,
    deviceId,
    result,
    receivedAt,
  }) {
    database
      .prepare(
        'INSERT INTO changes(change_id,branch_id,kind,record_id,revision,payload,changed_at,received_at,device_id,result) VALUES (?,?,?,?,?,?,?,?,?,?)',
      )
      .run(
        changeId,
        branchId,
        kind,
        recordId,
        revision,
        payload === null || payload === undefined ? null : JSON.stringify(payload),
        changedAt,
        receivedAt,
        deviceId,
        result,
      );
  }

  /** @param {{ branchId: string, kind: string, recordId: string, revision: number, payload: unknown, updatedAt: string, deviceId: string }} input */
  function writeHead({ branchId, kind, recordId, revision, payload, updatedAt, deviceId }) {
    database
      .prepare(
        `INSERT INTO records(branch_id,kind,id,revision,payload,updated_at,updated_by) VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(branch_id,kind,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,updated_at=excluded.updated_at,updated_by=excluded.updated_by`,
      )
      .run(
        branchId,
        kind,
        recordId,
        revision,
        payload === null || payload === undefined ? null : JSON.stringify(payload),
        updatedAt,
        deviceId,
      );
  }

  /** @param {{ branchId: string, deviceId: string, change: IncomingChange, receivedAt: string }} input @returns {PushResult} */
  function applyOne({ branchId, deviceId, change, receivedAt }) {
    const prior = findStoredChange(change.changeId);
    if (prior) {
      // Reluare (retry de rețea): nu se mai scrie nimic, se întoarce ce s-a decis prima dată.
      if (prior.result === 'conflict') {
        const head = findHeadRow(branchId, prior.kind, prior.record_id);
        return {
          changeId: change.changeId,
          status: 'conflict',
          revision: head?.revision ?? 0,
          head: head ? toHeadView(head) : undefined,
        };
      }
      return { changeId: change.changeId, status: prior.result, revision: prior.revision };
    }

    const headRow = findHeadRow(branchId, change.kind, change.recordId);
    const baseMatches = headRow ? headRow.revision === change.baseRevision : change.baseRevision === 0;

    if (baseMatches) {
      const nextRevision = (headRow?.revision ?? 0) + 1;
      writeHead({
        branchId,
        kind: change.kind,
        recordId: change.recordId,
        revision: nextRevision,
        payload: change.payload,
        updatedAt: change.changedAt,
        deviceId,
      });
      insertChangeRow({
        changeId: change.changeId,
        branchId,
        kind: change.kind,
        recordId: change.recordId,
        revision: nextRevision,
        payload: change.payload,
        changedAt: change.changedAt,
        deviceId,
        result: 'applied',
        receivedAt,
      });
      return { changeId: change.changeId, status: 'applied', revision: nextRevision };
    }

    if (isLastWriterWins(change.kind)) {
      if (!headRow || change.changedAt > headRow.updated_at) {
        const nextRevision = (headRow?.revision ?? 0) + 1;
        writeHead({
          branchId,
          kind: change.kind,
          recordId: change.recordId,
          revision: nextRevision,
          payload: change.payload,
          updatedAt: change.changedAt,
          deviceId,
        });
        insertChangeRow({
          changeId: change.changeId,
          branchId,
          kind: change.kind,
          recordId: change.recordId,
          revision: nextRevision,
          payload: change.payload,
          changedAt: change.changedAt,
          deviceId,
          result: 'applied',
          receivedAt,
        });
        return { changeId: change.changeId, status: 'applied', revision: nextRevision };
      }
      insertChangeRow({
        changeId: change.changeId,
        branchId,
        kind: change.kind,
        recordId: change.recordId,
        revision: headRow.revision,
        payload: change.payload,
        changedAt: change.changedAt,
        deviceId,
        result: 'superseded',
        receivedAt,
      });
      return { changeId: change.changeId, status: 'superseded', revision: headRow.revision, head: toHeadView(headRow) };
    }

    // Conflict (fișe, grupe, categorii, vizite): nimic scris în capul înregistrării,
    // doar rândul din changes — clientul parchează modificarea și arată alegerea (14c).
    insertChangeRow({
      changeId: change.changeId,
      branchId,
      kind: change.kind,
      recordId: change.recordId,
      revision: change.baseRevision,
      payload: change.payload,
      changedAt: change.changedAt,
      deviceId,
      result: 'conflict',
      receivedAt,
    });
    return {
      changeId: change.changeId,
      status: 'conflict',
      revision: /** @type {HeadRow} */ (headRow).revision,
      head: toHeadView(/** @type {HeadRow} */ (headRow)),
    };
  }

  /**
   * @param {{ branchId: string, deviceId: string, changes: IncomingChange[], now: Date }} input
   * @returns {{ results: PushResult[] }}
   */
  function applyPush({ branchId, deviceId, changes, now }) {
    const receivedAt = now.toISOString();
    /** @type {PushResult[]} */
    const results = [];
    database.exec('BEGIN IMMEDIATE');
    try {
      for (const change of changes) results.push(applyOne({ branchId, deviceId, change, receivedAt }));
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return { results };
  }

  /** @param {string} branchId */
  function branchHeadSeq(branchId) {
    const row = /** @type {{ maxSeq: number | null }} */ (
      database.prepare("SELECT MAX(seq) AS maxSeq FROM changes WHERE branch_id=? AND result='applied'").get(branchId)
    );
    return row.maxSeq ?? 0;
  }

  /**
   * @param {{ branchId: string, since: number, limit?: number }} input
   */
  function pull({ branchId, since, limit = 500 }) {
    const floor = Number(readMeta(database, 'changes_floor_seq') ?? 0);
    if (since < floor) fail('cursor-expirat', 410);
    const rows = /** @type {ChangeRow[]} */ (
      database
        .prepare("SELECT * FROM changes WHERE branch_id=? AND seq>? AND result='applied' ORDER BY seq LIMIT ?")
        .all(branchId, since, limit)
    );
    const headSeq = branchHeadSeq(branchId);
    const nextSince = rows.length ? rows[rows.length - 1].seq : Math.max(since, headSeq);
    return {
      changes: rows.map(row => ({
        seq: row.seq,
        changeId: row.change_id,
        kind: row.kind,
        recordId: row.record_id,
        revision: row.revision,
        payload: row.payload === null ? null : JSON.parse(row.payload),
        changedAt: row.changed_at,
        device: { id: row.device_id, name: devices.findById(row.device_id)?.name ?? '' },
      })),
      nextSince,
      headSeq,
    };
  }

  /**
   * Prima încărcare a unei filiale (decizia 9): fiecare rând ajunge la revizia 1,
   * cu un rând `changes` propriu — 409 dacă filiala are deja date pe server.
   * @param {{ branchId: string, deviceId: string, entries: { kind: string, id: string, payload: unknown, updatedAt: string }[], now: Date }} input
   */
  function writeSnapshot({ branchId, deviceId, entries, now }) {
    const existing = database.prepare('SELECT 1 FROM records WHERE branch_id=? LIMIT 1').get(branchId);
    if (existing) fail('branch-has-records', 409);
    const receivedAt = now.toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      for (const entry of entries) {
        writeHead({
          branchId,
          kind: entry.kind,
          recordId: entry.id,
          revision: 1,
          payload: entry.payload,
          updatedAt: entry.updatedAt,
          deviceId,
        });
        insertChangeRow({
          changeId: randomUUID(),
          branchId,
          kind: entry.kind,
          recordId: entry.id,
          revision: 1,
          payload: entry.payload,
          changedAt: entry.updatedAt,
          deviceId,
          result: 'applied',
          receivedAt,
        });
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return { headSeq: branchHeadSeq(branchId) };
  }

  /** @param {{ branchId: string }} input */
  function readSnapshot({ branchId }) {
    const rows = /** @type {HeadRow[]} */ (
      database.prepare('SELECT * FROM records WHERE branch_id=? ORDER BY kind,id').all(branchId)
    );
    /** @type {Record<string, { id: string, revision: number, payload: unknown, updatedAt: string }[]>} */
    const recordsByKind = {};
    for (const row of rows) {
      (recordsByKind[row.kind] ??= []).push({
        id: row.id,
        revision: row.revision,
        payload: row.payload === null ? null : JSON.parse(row.payload),
        updatedAt: row.updated_at,
      });
    }
    return { records: recordsByKind, headSeq: branchHeadSeq(branchId) };
  }

  return { applyPush, pull, writeSnapshot, readSnapshot, branchHeadSeq };
}
