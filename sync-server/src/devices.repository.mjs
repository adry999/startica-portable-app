import { completProfile, normalizeProfile } from './profile-policy.mjs';

/** @typedef {{ id: string, name: string, os: string, tokenHash: string, createdAt: string, lastSeenAt: string, lastBranchId: string | null, revokedAt: string | null, profile: ReturnType<typeof completProfile>, version: string | null }} DeviceView */

/** @param {import('node:sqlite').DatabaseSync} database */
export function createDevicesRepository(database) {
  /** @param {Record<string, unknown>} row @returns {DeviceView} */
  function toView(row) {
    return {
      id: /** @type {string} */ (row.id),
      name: /** @type {string} */ (row.name),
      os: /** @type {string} */ (row.os),
      tokenHash: /** @type {string} */ (row.token_hash),
      createdAt: /** @type {string} */ (row.created_at),
      lastSeenAt: /** @type {string} */ (row.last_seen_at),
      lastBranchId: /** @type {string | null} */ (row.last_branch_id ?? null),
      revokedAt: /** @type {string | null} */ (row.revoked_at ?? null),
      // §5.2 (37d): lipsă pe un dispozitiv care nu a mai trimis încă nicio cerere autentificată
      // cu X-Startica-Version (instalare dinainte de acest antet, sau între pair() și primul
      // request) — null, nu o versiune ghicită.
      version: /** @type {string | null} */ (row.last_version ?? null),
      // Un dispozitiv fără profil (instalare dinainte de §5.3) rămâne Complet — nicio
      // instalare existentă nu trebuie să se blocheze singură la prima pornire după upgrade.
      profile: row.profile_json
        ? normalizeProfile(JSON.parse(/** @type {string} */ (row.profile_json)))
        : completProfile(),
    };
  }

  /**
   * @param {{ id: string, name: string, os: string, tokenHash: string, now: string, profile?: unknown }} input
   * @returns {DeviceView}
   */
  function insert({ id, name, os, tokenHash, now, profile }) {
    const profileJson = profile ? JSON.stringify(normalizeProfile(/** @type {object} */ (profile))) : null;
    database
      .prepare('INSERT INTO devices(id,name,os,token_hash,created_at,last_seen_at,profile_json) VALUES (?,?,?,?,?,?,?)')
      .run(id, name, os, tokenHash, now, now, profileJson);
    const row = /** @type {Record<string, unknown>} */ (database.prepare('SELECT * FROM devices WHERE id=?').get(id));
    return toView(row);
  }

  /** @param {string} id @param {unknown} profile */
  function setProfile(id, profile) {
    database
      .prepare('UPDATE devices SET profile_json=? WHERE id=?')
      .run(JSON.stringify(normalizeProfile(/** @type {object} */ (profile))), id);
    return toView(
      /** @type {Record<string, unknown>} */ (database.prepare('SELECT * FROM devices WHERE id=?').get(id)),
    );
  }

  /** @param {string} tokenHash @returns {DeviceView | undefined} */
  function findByTokenHash(tokenHash) {
    const row = database.prepare('SELECT * FROM devices WHERE token_hash=?').get(tokenHash);
    return row ? toView(row) : undefined;
  }

  /** @param {string} id @returns {DeviceView | undefined} */
  function findById(id) {
    const row = database.prepare('SELECT * FROM devices WHERE id=?').get(id);
    return row ? toView(row) : undefined;
  }

  /** @returns {DeviceView[]} */
  function list() {
    return database
      .prepare('SELECT * FROM devices ORDER BY created_at')
      .all()
      .map(row => toView(row));
  }

  function countActive() {
    return /** @type {{ total: number }} */ (
      database.prepare('SELECT COUNT(*) AS total FROM devices WHERE revoked_at IS NULL').get()
    ).total;
  }

  /**
   * §5.2 (37d): `version` e opțional — scris doar când cererea a avut X-Startica-Version
   * (authenticate() din create-sync-server.mjs); apelurile ulterioare din aceeași cerere
   * (ex. push-ul din changes.routes.mjs, cu `branchId` dar fără `version`) nu-l șterg — SET
   * se construiește doar cu coloanele date, nu rescrie `last_version` cu NULL.
   * @param {string} id @param {{ branchId?: string, version?: string, now: string }} input
   */
  function touchLastSeen(id, { branchId, version, now }) {
    const sets = ['last_seen_at=?'];
    const params = [now];
    if (branchId) {
      sets.push('last_branch_id=?');
      params.push(branchId);
    }
    if (version) {
      sets.push('last_version=?');
      params.push(version);
    }
    params.push(id);
    database.prepare(`UPDATE devices SET ${sets.join(',')} WHERE id=?`).run(...params);
  }

  /** @param {string} id @param {string} now */
  function revoke(id, now) {
    database.prepare('UPDATE devices SET revoked_at=? WHERE id=?').run(now, id);
  }

  return { insert, findByTokenHash, findById, list, countActive, touchLastSeen, revoke, setProfile };
}
