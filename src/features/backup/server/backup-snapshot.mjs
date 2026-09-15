import { DatabaseSync } from 'node:sqlite';
import { fail } from '#core/server/errors/domain-error.mjs';
import { upgradeSnapshot } from '#shared/domain/record-snapshot-upgrade.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */

// Rândurile brute, indexate liber după kind: un backup dinainte de o entitate
// nouă poate avea tipuri lipsă, iar unul mai vechi decât aplicația curentă poate
// avea tipuri pe care aceasta nu le mai cunoaște — upgradeSnapshot() le tratează.
/** @param {import('node:sqlite').DatabaseSync} source */
function readRawSnapshot(source) {
  if (source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='records'").get()) {
    /** @type {Record<string, any[]>} */
    const raw = {};
    for (const row of source.prepare('SELECT kind,payload FROM records').all()) {
      const kind = /** @type {string} */ (row.kind);
      (raw[kind] ??= []).push(JSON.parse(/** @type {string} */ (row.payload)));
    }
    return raw;
  }
  const appState = /** @type {{ payload: string }} */ (
    source.prepare('SELECT payload FROM app_state WHERE id=1').get()
  );
  return JSON.parse(appState.payload);
}

// Citește o copie, verifică integritatea ei și aduce formatul la zi (vezi
// upgradeSnapshot). Folosit atât la previzualizarea unei restaurări, cât și ca
// validare a fiecărui backup înainte de a fi acceptat.
/**
 * @param {string} file
 * @returns {{ snapshot: RecordsSnapshot, notes: string[] }}
 */
export function readBackupSnapshotDetails(file) {
  const source = new DatabaseSync(file, { readOnly: true });
  try {
    const integrityCheck = /** @type {{ integrity_check: string }} */ (source.prepare('PRAGMA integrity_check').get());
    if (integrityCheck.integrity_check !== 'ok') fail('Backup corupt.');
    return upgradeSnapshot(readRawSnapshot(source));
  } finally {
    source.close();
  }
}

/**
 * @param {string} file
 * @returns {RecordsSnapshot}
 */
export function readBackupSnapshot(file) {
  return readBackupSnapshotDetails(file).snapshot;
}
