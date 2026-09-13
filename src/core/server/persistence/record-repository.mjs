import { emptyState } from '#shared/domain/record-schema.mjs';

/** @param {import('node:sqlite').DatabaseSync} database */
export function createRecordRepository(database) {
  function readSnapshot() {
    const snapshot = emptyState();
    for (const row of database.prepare('SELECT kind,payload FROM records ORDER BY rowid').all()) {
      const kind = /** @type {string} */ (row.kind);
      const payload = /** @type {string} */ (row.payload);
      snapshot[kind].push(JSON.parse(payload));
    }
    return snapshot;
  }

  function readEnvelope() {
    const meta = /** @type {{ revision: number, updated_at: string }} */ (
      database.prepare('SELECT * FROM meta WHERE id=1').get()
    );
    return { state: readSnapshot(), revision: meta.revision, updatedAt: meta.updated_at };
  }

  // Verificarea reviziei și căutarea unei singure înregistrări nu au nevoie de
  // starea completă. readSnapshot() parsează JSON pentru fiecare rând din bază;
  // folosit pentru a compara un întreg, costul crește cu toată evidența.
  const currentRevision = () =>
    /** @type {{ revision: number }} */ (database.prepare('SELECT revision FROM meta WHERE id=1').get()).revision;

  function find(type, id) {
    const row = database.prepare('SELECT payload FROM records WHERE kind=? AND id=?').get(type, id);
    return row ? JSON.parse(/** @type {string} */ (row.payload)) : undefined;
  }

  const exists = (type, id) => !!database.prepare('SELECT 1 FROM records WHERE kind=? AND id=?').get(type, id);

  const save = (type, record) =>
    database
      .prepare('INSERT INTO records VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload')
      .run(type, record.id, JSON.stringify(record));

  const remove = (type, id) => database.prepare('DELETE FROM records WHERE kind=? AND id=?').run(type, id);

  return { readSnapshot, readEnvelope, currentRevision, find, exists, save, remove };
}
