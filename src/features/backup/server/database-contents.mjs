import { DatabaseSync } from 'node:sqlite';

/** @typedef {Record<string, number>} DatabaseContentCounts */

// Tabele interne/bookkeeping, fără sens pentru „ce conține acest backup” — un
// revizor care citește counts vrea tipuri de date (copii, achitări, personal,
// prezență…), nu detalii de infrastructură de sincronizare sau idempotență.
// `records` nu e aici: e numărată separat, grupat pe `kind` (vezi mai jos).
const INFRASTRUCTURE_TABLES = new Set([
  'sqlite_sequence',
  'meta',
  'requests',
  'settings',
  'sync_state',
  'sync_outbox',
  'sync_conflicts',
]);

/**
 * Numărătoarea pe tipuri a unei baze — derivată din `sqlite_master`, nu dintr-o listă
 * scrisă de mână: orice tabel nou (sau kind nou în `records`) apare automat, fără cod
 * nou (docs/superpowers/plans/2026-10-01-backup-complet.md, decizia 3). Tabela generică
 * `records` (kind/id/payload — TYPES din record-schema.mjs pe o bază de filială,
 * PERSONAL_KINDS din personal-schema.mjs pe baza comună) se grupează pe `kind`; fiecare
 * alt tabel real (attendance, sms_log, pool_bookings, audit_changes…) își are propriul
 * `COUNT(*)`.
 * @param {string} dbFile
 * @returns {DatabaseContentCounts}
 */
export function summarizeDatabaseContents(dbFile) {
  const db = new DatabaseSync(dbFile, { readOnly: true });
  try {
    const tables = /** @type {{ name: string }[]} */ (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
    ).map(row => row.name);

    /** @type {DatabaseContentCounts} */
    const counts = {};
    for (const table of tables) {
      if (INFRASTRUCTURE_TABLES.has(table)) continue;
      if (table === 'records') {
        const rows = /** @type {{ kind: string, n: number }[]} */ (
          db.prepare('SELECT kind, COUNT(*) AS n FROM records GROUP BY kind').all()
        );
        for (const row of rows) counts[row.kind] = row.n;
        continue;
      }
      const row = /** @type {{ n: number }} */ (db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get());
      counts[table] = row.n;
    }
    return counts;
  } finally {
    db.close();
  }
}
