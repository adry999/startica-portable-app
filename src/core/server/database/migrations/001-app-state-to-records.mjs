import { TYPES } from '#shared/domain/record-schema.mjs';

const hasTable = (database, name) =>
  !!database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);

export const migration = {
  version: 1,
  description: 'app_state (JSON unic) → records (un rând per fișă)',
  run(database) {
    if (!hasTable(database, 'app_state')) return;
    const row = database.prepare('SELECT payload FROM app_state WHERE id=1').get();
    if (!row) return;
    const legacy = JSON.parse(row.payload);
    for (const type of TYPES)
      for (const record of legacy[type] || [])
        database.prepare('INSERT INTO records VALUES(?,?,?)').run(type, record.id, JSON.stringify(record));
  },
};
