import { TYPES } from '#shared/domain/record-schema.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { createSyncStateRepository } from './sync-state.repository.mjs';
import { createSettingsRepository } from '#core/server/settings/settings-repository.mjs';

const SYNC_SINCE_SETTING = 'sync.since';

/**
 * Prima încărcare a unei filiale cu date (Task 11, decizia 9): toată evidența, plată,
 * ca `entries` pentru `POST /v1/branches/:id/snapshot`. Fără `sync_state` local încă —
 * fiecare rând devine revizia 1 pe server (`writeSnapshot`), deci un singur `updatedAt`
 * (momentul încărcării) e suficient; nu există o valoare „ultima schimbare” mai bună de
 * atât pentru înregistrări create înainte ca sincronizarea să existe.
 * @param {import('node:sqlite').DatabaseSync} database
 * @param {{ now: () => Date }} dependencies
 */
export function readLocalSnapshot(database, { now }) {
  const raw = createRecordRepository(database);
  const state = raw.readSnapshot();
  const updatedAt = now().toISOString();
  /** @type {{ kind: string, id: string, payload: unknown, updatedAt: string }[]} */
  const entries = [];
  for (const kind of TYPES) {
    for (const record of state[kind] ?? []) entries.push({ kind, id: record.id, payload: record, updatedAt });
  }
  return { entries };
}

/**
 * Descărcarea unei filiale noi (Task 11): scrie brut fiecare cap primit (fără outbox —
 * exact ce a spus serverul e adevărul de plecare) și `sync_state`-ul lui, apoi cursorul
 * `sync.since = headSeq`, ca motorul pornit ulterior să continue de acolo, nu de la 0.
 * @param {import('node:sqlite').DatabaseSync} database
 * @param {{ records: Record<string, { id: string, revision: number, payload: unknown, updatedAt: string }[]>, headSeq: number }} snapshot
 */
export function writeLocalSnapshot(database, { records, headSeq }) {
  const raw = createRecordRepository(database);
  const syncState = createSyncStateRepository(database);
  const settings = createSettingsRepository(database);

  database.exec('BEGIN IMMEDIATE');
  try {
    for (const [kind, rows] of Object.entries(records)) {
      for (const row of rows) {
        if (row.payload !== null) raw.save(kind, /** @type {{ id: string }} */ (row.payload));
        syncState.set(kind, row.id, {
          serverRevision: row.revision,
          updatedAt: row.updatedAt,
          updatedByDevice: '',
          updatedByName: '',
        });
      }
    }
    settings.setSetting(SYNC_SINCE_SETTING, String(headSeq));
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
