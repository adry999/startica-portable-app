import { DatabaseSync } from 'node:sqlite';
import { fail } from '#core/server/errors/domain-error.mjs';
import { emptyState } from '#shared/domain/record-schema.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */

// Citește o copie și verifică integritatea ei. Folosit atât la previzualizarea
// unei restaurări, cât și ca validare a fiecărui backup înainte de a fi acceptat.
/**
 * @param {string} file
 * @returns {RecordsSnapshot}
 */
export function readBackupSnapshot(file) {
  const source = new DatabaseSync(file, { readOnly: true });
  try {
    const integrityCheck = /** @type {{ integrity_check: string }} */ (source.prepare('PRAGMA integrity_check').get());
    if (integrityCheck.integrity_check !== 'ok') fail('Backup corupt.');
    if (source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='records'").get()) {
      const snapshot = emptyState();
      for (const row of source.prepare('SELECT kind,payload FROM records').all()) {
        const kind = /** @type {string} */ (row.kind);
        const payload = /** @type {string} */ (row.payload);
        snapshot[kind].push(JSON.parse(payload));
      }
      return snapshot;
    }
    const appState = /** @type {{ payload: string }} */ (
      source.prepare('SELECT payload FROM app_state WHERE id=1').get()
    );
    return JSON.parse(appState.payload);
  } finally {
    source.close();
  }
}
