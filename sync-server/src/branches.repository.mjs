/** @typedef {{ id: string, name: string, color: string, address: string, createdAt: string, updatedAt: string, uploadedBy: string | null, uploadedAt: string | null, nextReceiptNumber: number }} BranchView */

/** @param {import('node:sqlite').DatabaseSync} database */
export function createBranchesRepository(database) {
  /** @param {Record<string, unknown>} row @returns {BranchView} */
  function toView(row) {
    return {
      id: /** @type {string} */ (row.id),
      name: /** @type {string} */ (row.name),
      color: /** @type {string} */ (row.color),
      address: /** @type {string} */ (row.address),
      createdAt: /** @type {string} */ (row.created_at),
      updatedAt: /** @type {string} */ (row.updated_at),
      uploadedBy: /** @type {string | null} */ (row.uploaded_by ?? null),
      uploadedAt: /** @type {string | null} */ (row.uploaded_at ?? null),
      nextReceiptNumber: /** @type {number} */ (row.next_receipt_number),
    };
  }

  /** @param {string} id @returns {BranchView | undefined} */
  function findById(id) {
    const row = database.prepare('SELECT * FROM branches WHERE id=?').get(id);
    return row ? toView(row) : undefined;
  }

  /** @returns {BranchView[]} */
  function list() {
    return database
      .prepare('SELECT * FROM branches ORDER BY created_at')
      .all()
      .map(row => toView(row));
  }

  function count() {
    return /** @type {{ total: number }} */ (database.prepare('SELECT COUNT(*) AS total FROM branches').get()).total;
  }

  /**
   * Înregistrare idempotentă după id (decizia 3, filiala = un dataset unic pe server).
   * O filială deja cunoscută e actualizată doar când `updatedAt` primit e mai nou decât
   * cel din bază, ca o redenumire făcută în altă parte să nu fie retrogradată de o cerere veche.
   * @param {{ id: string, name: string, color: string, address: string, createdAt: string, updatedAt: string, uploadedBy?: string, now: string }} input
   * @returns {{ branch: BranchView, created: boolean }}
   */
  function register({ id, name, color, address, createdAt, updatedAt, uploadedBy, now }) {
    const existing = findById(id);
    if (!existing) {
      database
        .prepare(
          'INSERT INTO branches(id,name,color,address,created_at,updated_at,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?,?)',
        )
        .run(id, name, color, address, createdAt, updatedAt, uploadedBy ?? null, now);
      return { branch: /** @type {BranchView} */ (findById(id)), created: true };
    }
    if (updatedAt > existing.updatedAt)
      database
        .prepare('UPDATE branches SET name=?,color=?,address=?,updated_at=? WHERE id=?')
        .run(name, color, address, updatedAt, id);
    return { branch: /** @type {BranchView} */ (findById(id)), created: false };
  }

  return { findById, list, count, register };
}
