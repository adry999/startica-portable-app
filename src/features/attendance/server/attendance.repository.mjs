/** @typedef {import('../attendance.types.d.mts').AttendanceEntry} AttendanceEntry */
/** @typedef {import('../attendance.types.d.mts').AttendanceChange} AttendanceChange */

/** @param {any} row @returns {AttendanceEntry} */
const toEntry = row => ({
  childId: row.child_id,
  date: row.date,
  status: row.status,
  reason: row.reason,
  updatedAt: row.updated_at,
});

/** @param {string} month format YYYY-MM @returns {[string, string]} */
function monthBounds(month) {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const start = `${month}-01`;
  const end =
    monthNumber === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;
  return [start, end];
}

/**
 * @param {import('node:sqlite').DatabaseSync} database
 * @param {{ now?: () => Date }} [options]
 */
export function createAttendanceRepository(database, { now = () => new Date() } = {}) {
  const selectByDateStatement = database.prepare(
    'SELECT child_id,date,status,reason,updated_at FROM attendance WHERE date=? ORDER BY child_id',
  );
  const selectByMonthStatement = database.prepare(
    'SELECT child_id,date,status,reason,updated_at FROM attendance WHERE date>=? AND date<? ORDER BY date,child_id',
  );
  const selectOneStatement = database.prepare(
    'SELECT child_id,date,status,reason,updated_at FROM attendance WHERE child_id=? AND date=?',
  );
  const deleteStatement = database.prepare('DELETE FROM attendance WHERE child_id=? AND date=?');
  const upsertStatement = database.prepare(
    `INSERT INTO attendance(child_id,date,status,reason,updated_at) VALUES(?,?,?,?,?)
     ON CONFLICT(child_id,date) DO UPDATE SET status=excluded.status,reason=excluded.reason,updated_at=excluded.updated_at`,
  );

  /** @param {string} date @returns {AttendanceEntry[]} */
  function listByDate(date) {
    return selectByDateStatement.all(date).map(toEntry);
  }

  /** @param {string} month @param {string[] | null} [childIds] @returns {AttendanceEntry[]} */
  function listByMonth(month, childIds = null) {
    const [start, end] = monthBounds(month);
    const entries = selectByMonthStatement.all(start, end).map(toEntry);
    if (!childIds) return entries;
    const allowed = new Set(childIds);
    return entries.filter(entry => allowed.has(entry.childId));
  }

  /**
   * O singură tranzacție pentru tot lotul: fie toate schimbările se salvează, fie niciuna.
   * Aceeași pereche (childId,date) apărută de două ori în lot: câștigă ultima (spec: last write wins).
   * @param {AttendanceChange[]} changes
   * @returns {{ saved: AttendanceEntry[], removed: { childId: string, date: string }[] }}
   */
  function applyChanges(changes) {
    const nowIso = now().toISOString();
    const byKey = new Map();
    for (const change of changes) byKey.set(`${change.childId}|${change.date}`, change);

    database.exec('BEGIN IMMEDIATE');
    try {
      const saved = [];
      const removed = [];
      for (const change of byKey.values()) {
        const { childId, date, status, reason = '' } = change;
        if (status === null) {
          deleteStatement.run(childId, date);
          removed.push({ childId, date });
        } else {
          upsertStatement.run(childId, date, status, reason, nowIso);
          saved.push(toEntry(selectOneStatement.get(childId, date)));
        }
      }
      database.exec('COMMIT');
      return { saved, removed };
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  return { listByDate, listByMonth, applyChanges };
}

/** @typedef {ReturnType<typeof createAttendanceRepository>} AttendanceRepository */
