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
  /** @type {{ kind: string, id: string, payload: unknown | null }[]} */
  let pendingChanges = [];

  // onChange rulează întotdeauna după COMMIT, niciodată în interiorul tranzacției care
  // a scris — un abonat (backup automat, E-1 din audit) poate face o operație sincronă
  // proprie (VACUUM INTO) fără să lovească „cannot VACUUM from within a transaction”.
  // Aceeași conexiune vede oricum propriile scrieri necomise, deci nimic nu pierde din
  // vizibilitate față de a notifica înainte de COMMIT.
  function flushPendingChanges() {
    const changes = pendingChanges;
    pendingChanges = [];
    for (const change of changes) onChange?.(change);
  }

  /** @template T @param {() => T} action @returns {T} */
  function withOwnTransaction(action) {
    if (inTransaction) return action();
    database.exec('BEGIN IMMEDIATE');
    let result;
    try {
      result = action();
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      pendingChanges = [];
      throw error;
    }
    flushPendingChanges();
    return result;
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
      pendingChanges.push({ kind, id: record.id, payload: record });
      return record;
    });
  }

  /** @param {string} kind @param {string} id */
  function remove(kind, id) {
    return withOwnTransaction(() => {
      removeStatement.run(kind, id);
      pendingChanges.push({ kind, id, payload: null });
    });
  }

  /** @template T @param {() => T} fn @returns {T} */
  function transaction(fn) {
    if (inTransaction) return fn();
    database.exec('BEGIN IMMEDIATE');
    inTransaction = true;
    let result;
    try {
      result = fn();
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      pendingChanges = [];
      throw error;
    } finally {
      inTransaction = false;
    }
    flushPendingChanges();
    return result;
  }

  return { list, find, save, remove, transaction };
}

/** @typedef {ReturnType<typeof createKindRepository>} KindRepository */
