import { completProfile, normalizeProfile } from './profile-policy.mjs';

/** @typedef {{ id: string, name: string, os: string, tokenHash: string, createdAt: string, lastSeenAt: string, lastBranchId: string | null, revokedAt: string | null, profile: ReturnType<typeof completProfile> }} DeviceView */

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

  /** @param {string} id @param {{ branchId?: string, now: string }} input */
  function touchLastSeen(id, { branchId, now }) {
    if (branchId)
      database.prepare('UPDATE devices SET last_seen_at=?, last_branch_id=? WHERE id=?').run(now, branchId, id);
    else database.prepare('UPDATE devices SET last_seen_at=? WHERE id=?').run(now, id);
  }

  /** @param {string} id @param {string} now */
  function revoke(id, now) {
    database.prepare('UPDATE devices SET revoked_at=? WHERE id=?').run(now, id);
  }

  return { insert, findByTokenHash, findById, list, countActive, touchLastSeen, revoke, setProfile };
}
