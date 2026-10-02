import { randomUUID } from 'node:crypto';
import { fail } from './router.mjs';
import { isLastWriterWins } from './change-policy.mjs';
import { branchFloorKey, readMeta } from './backup.service.mjs';
import {
  ACCESS_READ,
  ACCESS_WRITE,
  AUDIT_LOG_KIND,
  CHILDREN_FIELDS_HIDDEN_WITHOUT_PAYMENTS,
  KIND_MODULE,
  completProfile,
  isModuleAllowed,
} from './profile-policy.mjs';

/** @typedef {{ branch_id: string, kind: string, id: string, revision: number, payload: string | null, updated_at: string, updated_by: string }} HeadRow */
/** @typedef {{ seq: number, change_id: string, branch_id: string, kind: string, record_id: string, revision: number, payload: string | null, changed_at: string, received_at: string, device_id: string, result: string }} ChangeRow */
/** @typedef {{ changeId: string, kind: string, recordId: string, baseRevision: number, payload: unknown, changedAt: string }} IncomingChange */
/** @typedef {{ payload: unknown, revision: number, updatedAt: string, updatedBy: { id: string, name: string } }} HeadView */
/** @typedef {{ changeId: string, status: string, revision: number, head?: HeadView }} PushResult */
/** @typedef {{ blocked: boolean, modules: Record<string, number>, preset: string, pinModules: string[] }} DeviceProfile */

/**
 * §5.3 (36g): fiecare calculator trebuie să-și poată trimite propriile intrări de istoric
 * (altfel istoricul central n-ar avea ce arăta pentru un calculator restrâns) — `audit_log`
 * nu e guvernat de `admin` ca restul tipurilor din `KIND_MODULE`.
 * @param {{ blocked: boolean, modules: Record<string, number> }} profile
 * @param {string} kind
 */
function canWriteKind(profile, kind) {
  if (profile.blocked) return false;
  if (kind === AUDIT_LOG_KIND) return true;
  const moduleId = KIND_MODULE[kind];
  return moduleId ? isModuleAllowed(profile, moduleId, ACCESS_WRITE) : true;
}

/**
 * §5.3 (36g): „doar dispozitivele Complet [primesc audit_log] la pull” — nu doar nivelul
 * generic de citire pe `admin` (oricum mereu 0 în afara profilului Complet), explicit pe preset.
 * @param {{ blocked: boolean, modules: Record<string, number>, preset: string }} profile
 * @param {string} kind
 */
function canReadKind(profile, kind) {
  if (profile.blocked) return false;
  if (kind === AUDIT_LOG_KIND) return profile.preset === 'complet';
  const moduleId = KIND_MODULE[kind];
  return moduleId ? isModuleAllowed(profile, moduleId, ACCESS_READ) : true;
}

/** 36e: „plățile, planul tarifar și notele medicale nu sunt pe acest calculator” — câmpurile
 * rămân tăiate din `children` indiferent de nivelul de acces pe modulul `children` însuși.
 * @param {DeviceProfile} profile */
function shouldHideChildrenFinancials(profile) {
  return !isModuleAllowed(profile, 'payments', ACCESS_READ);
}

/** @param {string} kind @param {unknown} payload @param {DeviceProfile} profile */
function redactPayloadForProfile(kind, payload, profile) {
  if (kind !== 'children' || payload === null || typeof payload !== 'object' || !shouldHideChildrenFinancials(profile))
    return payload;
  const redacted = { ...payload };
  for (const field of CHILDREN_FIELDS_HIDDEN_WITHOUT_PAYMENTS) delete redacted[field];
  return redacted;
}

/**
 * Nucleul politicii de sincronizare (decizia 5): o revizie curentă se aplică; una
 * depășită e conflict pentru fișe/grupe/categorii/vizite și last-writer-wins pentru
 * restul; un `changeId` reluat întoarce rezultatul memorat, fără a scrie a doua oară.
 * @param {{ database: import('node:sqlite').DatabaseSync, devices: ReturnType<typeof import('./devices.repository.mjs').createDevicesRepository> }} dependencies
 */
export function createChangesService({ database, devices }) {
  /** Un `deviceId` absent (apeluri vechi, teste) se comportă ca Complet — filtrarea de profil
   * e strict aditivă peste contractul existent. @param {string | undefined} deviceId */
  function profileForDevice(deviceId) {
    if (!deviceId) return completProfile();
    return devices.findById(deviceId)?.profile ?? completProfile();
  }
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

  /** @param {{ branchId: string, deviceId: string, change: IncomingChange, receivedAt: string, profile: DeviceProfile }} input @returns {PushResult} */
  function applyOne({ branchId, deviceId, change, receivedAt, profile }) {
    const prior = findStoredChange(change.changeId);
    if (prior) {
      // Reluare (retry de rețea): nu se mai scrie nimic, se întoarce ce s-a decis prima dată.
      // `head` trebuie inclus și pentru „superseded” (D-2) — fără el, clientul nu poate
      // decide dacă șterge rândul din outbox, și rămâne „pending” la nesfârșit.
      if (prior.result === 'conflict' || prior.result === 'superseded') {
        const head = findHeadRow(branchId, prior.kind, prior.record_id);
        return {
          changeId: change.changeId,
          status: prior.result,
          revision: head?.revision ?? prior.revision,
          head: head ? toHeadView(head) : undefined,
        };
      }
      return { changeId: change.changeId, status: prior.result, revision: prior.revision };
    }

    // §5.3 (36g, 36f): profilul decide pe rând, nu pe tot lotul — restul modificărilor din
    // același push nu trebuie respinse doar pentru că una dintre ele atinge un modul interzis.
    if (!canWriteKind(profile, change.kind)) {
      const headRow = findHeadRow(branchId, change.kind, change.recordId);
      insertChangeRow({
        changeId: change.changeId,
        branchId,
        kind: change.kind,
        recordId: change.recordId,
        revision: headRow?.revision ?? change.baseRevision,
        payload: change.payload,
        changedAt: change.changedAt,
        deviceId,
        result: 'rejected',
        receivedAt,
      });
      return { changeId: change.changeId, status: 'rejected', revision: headRow?.revision ?? change.baseRevision };
    }

    // `audit_log` e append-only (36g): niciun client n-are voie să rescrie o intrare deja
    // trimisă — fiecare modificare trebuie să fie o înregistrare nouă, cu baseRevision 0.
    if (change.kind === AUDIT_LOG_KIND) {
      const existing = findHeadRow(branchId, change.kind, change.recordId);
      if (existing || change.baseRevision !== 0) {
        insertChangeRow({
          changeId: change.changeId,
          branchId,
          kind: change.kind,
          recordId: change.recordId,
          revision: existing?.revision ?? change.baseRevision,
          payload: change.payload,
          changedAt: change.changedAt,
          deviceId,
          result: 'rejected',
          receivedAt,
        });
        return { changeId: change.changeId, status: 'rejected', revision: existing?.revision ?? change.baseRevision };
      }
      writeHead({
        branchId,
        kind: change.kind,
        recordId: change.recordId,
        revision: 1,
        payload: change.payload,
        updatedAt: change.changedAt,
        deviceId,
      });
      insertChangeRow({
        changeId: change.changeId,
        branchId,
        kind: change.kind,
        recordId: change.recordId,
        revision: 1,
        payload: change.payload,
        changedAt: change.changedAt,
        deviceId,
        result: 'applied',
        receivedAt,
      });
      return { changeId: change.changeId, status: 'applied', revision: 1 };
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
    const profile = profileForDevice(deviceId);
    /** @type {PushResult[]} */
    const results = [];
    database.exec('BEGIN IMMEDIATE');
    try {
      for (const change of changes) results.push(applyOne({ branchId, deviceId, change, receivedAt, profile }));
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
   * @param {{ branchId: string, since: number, limit?: number, deviceId?: string }} input
   */
  function pull({ branchId, since, limit = 500, deviceId }) {
    // Pragul e per filială (D-4): o filială fără istoric curățat nu primește 410 doar
    // pentru că altă filială a trecut de SYNC_HISTORY_DAYS.
    const floor = Number(readMeta(database, branchFloorKey(branchId)) ?? 0);
    if (since < floor) fail('cursor-expirat', 410);
    const rows = /** @type {ChangeRow[]} */ (
      database
        .prepare("SELECT * FROM changes WHERE branch_id=? AND seq>? AND result='applied' ORDER BY seq LIMIT ?")
        .all(branchId, since, limit)
    );
    const headSeq = branchHeadSeq(branchId);
    // §5.3: cursorul avansează pe lotul complet (rows), nu pe cel filtrat — altfel un profil
    // restrâns ar rămâne blocat la nesfârșit pe primul rând pe care nu are voie să-l vadă.
    const nextSince = rows.length ? rows[rows.length - 1].seq : Math.max(since, headSeq);
    const profile = profileForDevice(deviceId);
    const visible = rows.filter(row => canReadKind(profile, row.kind));
    return {
      changes: visible.map(row => ({
        seq: row.seq,
        changeId: row.change_id,
        kind: row.kind,
        recordId: row.record_id,
        revision: row.revision,
        payload: row.payload === null ? null : redactPayloadForProfile(row.kind, JSON.parse(row.payload), profile),
        changedAt: row.changed_at,
        device: { id: row.device_id, name: devices.findById(row.device_id)?.name ?? '' },
      })),
      nextSince,
      headSeq,
    };
  }

  /**
   * Prima încărcare a unei filiale (decizia 9): fiecare rând ajunge la revizia 1,
   * cu un rând `changes` propriu — 409 dacă filiala are deja date pe server. §5.3: intrările
   * pentru module nepermise se sar (nu opresc restul instantaneului), raportate în `skipped`.
   * @param {{ branchId: string, deviceId: string, entries: { kind: string, id: string, payload: unknown, updatedAt: string }[], now: Date }} input
   */
  function writeSnapshot({ branchId, deviceId, entries, now }) {
    const existing = database.prepare('SELECT 1 FROM records WHERE branch_id=? LIMIT 1').get(branchId);
    if (existing) fail('branch-has-records', 409);
    const receivedAt = now.toISOString();
    const profile = profileForDevice(deviceId);
    /** @type {string[]} */
    const skipped = [];
    database.exec('BEGIN IMMEDIATE');
    try {
      for (const entry of entries) {
        if (!canWriteKind(profile, entry.kind)) {
          skipped.push(entry.id);
          continue;
        }
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
    return { headSeq: branchHeadSeq(branchId), skipped };
  }

  /** @param {{ branchId: string, deviceId?: string }} input */
  function readSnapshot({ branchId, deviceId }) {
    const rows = /** @type {HeadRow[]} */ (
      database.prepare('SELECT * FROM records WHERE branch_id=? ORDER BY kind,id').all(branchId)
    );
    const profile = profileForDevice(deviceId);
    /** @type {Record<string, { id: string, revision: number, payload: unknown, updatedAt: string, updatedBy: { id: string, name: string } }[]>} */
    const recordsByKind = {};
    for (const row of rows) {
      if (!canReadKind(profile, row.kind)) continue;
      // §5.3/36g (Point 1/2, PROMPT-CLAUDE-CODE-10 §5): o intrare `audit_log` dintr-un
      // instantaneu (pairing sau resincronizare 410) are nevoie de identitatea calculatorului
      // care a scris-o, la fel ca la pull() mai sus (`device`) — altfel clientul n-ar avea de
      // unde să știe cui să atribuie intrarea fără să se bazeze pe `payload.deviceId`
      // (auto-raportat, nesigur). Adăugat pe fiecare rând, nu doar pe `audit_log`: ieftin
      // (devices.findById e deja folosit identic la pull()) și consistent cu `toHeadView`.
      (recordsByKind[row.kind] ??= []).push({
        id: row.id,
        revision: row.revision,
        payload: row.payload === null ? null : redactPayloadForProfile(row.kind, JSON.parse(row.payload), profile),
        updatedAt: row.updated_at,
        updatedBy: { id: row.updated_by, name: devices.findById(row.updated_by)?.name ?? '' },
      });
    }
    return { records: recordsByKind, headSeq: branchHeadSeq(branchId) };
  }

  return { applyPush, pull, writeSnapshot, readSnapshot, branchHeadSeq };
}
