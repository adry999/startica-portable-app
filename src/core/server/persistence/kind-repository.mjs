/**
 * Depozit generic pe tabela `records(kind,id,payload)`, pentru date care nu trec prin
 * `createRecordRepository`/`TYPES` (Personal 24 — docs/superpowers/plans/2026-09-27-personal-bazin.md,
 * decizia 2): fără revizie globală, fără `/api/state`. Fiecare `save`/`remove` e propria
 * tranzacție `BEGIN IMMEDIATE` (precedentul attendance), cu `onChange` notificat înăuntru;
 * `transaction(fn)` grupează mai multe scrieri într-una singură, atomic.
 * @param {import('node:sqlite').DatabaseSync} database
 * @param {{ onChange?: (change: { kind: string, id: string, payload: unknown | null }) => void }} [options]
 */
export function createKindRepository(database, { onChange } = {}) {
  const listStatement = database.prepare('SELECT payload FROM records WHERE kind=? ORDER BY id');
  const findStatement = database.prepare('SELECT payload FROM records WHERE kind=? AND id=?');
  const saveStatement = database.prepare(
    'INSERT INTO records VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload',
  );
  const removeStatement = database.prepare('DELETE FROM records WHERE kind=? AND id=?');

  let inTransaction = false;

  /** @template T @param {() => T} action @returns {T} */
  function withOwnTransaction(action) {
    if (inTransaction) return action();
    database.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      database.exec('COMMIT');
      return result;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  /** @param {string} kind */
  function list(kind) {
    return listStatement.all(kind).map(row => JSON.parse(/** @type {string} */ (row.payload)));
  }

  /** @param {string} kind @param {string} id */
  function find(kind, id) {
    const row = findStatement.get(kind, id);
    return row ? JSON.parse(/** @type {string} */ (row.payload)) : undefined;
  }

  /** @template {{ id: string }} T @param {string} kind @param {T} record @returns {T} */
  function save(kind, record) {
    return withOwnTransaction(() => {
      saveStatement.run(kind, record.id, JSON.stringify(record));
      onChange?.({ kind, id: record.id, payload: record });
      return record;
    });
  }

  /** @param {string} kind @param {string} id */
  function remove(kind, id) {
    return withOwnTransaction(() => {
      removeStatement.run(kind, id);
      onChange?.({ kind, id, payload: null });
    });
  }

  /** @template T @param {() => T} fn @returns {T} */
  function transaction(fn) {
    if (inTransaction) return fn();
    database.exec('BEGIN IMMEDIATE');
    inTransaction = true;
    try {
      const result = fn();
      database.exec('COMMIT');
      return result;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    } finally {
      inTransaction = false;
    }
  }

  return { list, find, save, remove, transaction };
}

/** @typedef {ReturnType<typeof createKindRepository>} KindRepository */
