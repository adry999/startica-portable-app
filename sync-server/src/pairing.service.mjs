import { randomInt } from 'node:crypto';

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/** @typedef {{ code: string, created_by: string, created_at: string, expires_at: string, used_at: string | null, attempts: number }} PairingCodeRow */

/** @param {import('node:sqlite').DatabaseSync} database */
export function createPairingService(database) {
  function generateCode() {
    return String(randomInt(100000, 999999)).padStart(6, '0');
  }

  /** @param {{ createdBy: string, now: Date }} input */
  function createCode({ createdBy, now }) {
    // 900.000 de coduri posibile: o coliziune e practic imposibilă, dar re-generăm
    // în caz că un cod încă valabil se repetă.
    for (;;) {
      const code = generateCode();
      if (database.prepare('SELECT 1 FROM pairing_codes WHERE code=?').get(code)) continue;
      const createdAt = now.toISOString();
      const expiresAt = new Date(now.getTime() + CODE_TTL_MS).toISOString();
      database
        .prepare('INSERT INTO pairing_codes(code,created_by,created_at,expires_at,attempts) VALUES (?,?,?,?,0)')
        .run(code, createdBy, createdAt, expiresAt);
      return { code, expiresAt };
    }
  }

  /** @param {PairingCodeRow} row */
  function registerFailedAttempt(row) {
    const attempts = row.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) database.prepare('DELETE FROM pairing_codes WHERE code=?').run(row.code);
    else database.prepare('UPDATE pairing_codes SET attempts=? WHERE code=?').run(attempts, row.code);
  }

  /**
   * @param {{ code: string, now: Date }} input
   * @returns {{ ok: true, createdBy: string } | { ok: false, reason: 'not-found' | 'used' | 'expired' }}
   */
  function consumeCode({ code, now }) {
    const row = /** @type {PairingCodeRow | undefined} */ (
      database.prepare('SELECT * FROM pairing_codes WHERE code=?').get(code)
    );
    if (!row) return { ok: false, reason: 'not-found' };
    if (row.used_at) {
      registerFailedAttempt(row);
      return { ok: false, reason: 'used' };
    }
    if (new Date(row.expires_at).getTime() < now.getTime()) {
      registerFailedAttempt(row);
      return { ok: false, reason: 'expired' };
    }
    database.prepare('UPDATE pairing_codes SET used_at=? WHERE code=?').run(now.toISOString(), code);
    return { ok: true, createdBy: row.created_by };
  }

  return { createCode, consumeCode };
}
