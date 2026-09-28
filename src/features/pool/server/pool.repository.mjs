/** @typedef {import('../pool.types.d.mts').PoolBooking} PoolBooking */
/** @typedef {import('../pool.types.d.mts').PoolSession} PoolSession */

/** @param {any} row @returns {PoolBooking} */
const toBooking = row => ({
  id: row.id,
  childId: row.child_id,
  coachId: row.coach_id,
  weekday: row.weekday,
  time: row.time,
  startDate: row.start_date,
  endDate: row.end_date,
  archivedAt: row.archived_at,
  updatedAt: row.updated_at,
});

/** @param {any} row @returns {PoolSession} */
const toSession = row => ({ bookingId: row.booking_id, date: row.date, status: row.status, updatedAt: row.updated_at });

/**
 * Depozitul dedicat al bazinului (decizia 11, 2026-09-27-personal-bazin.md) — tabele proprii, nu
 * `records(kind,id,payload)`: sesiunile sunt copii × săptămâni și n-au ce căuta în `/api/state`.
 * @param {import('node:sqlite').DatabaseSync} database
 */
export function createPoolRepository(database) {
  const selectBookingsStatement = database.prepare(
    'SELECT id,child_id,coach_id,weekday,time,start_date,end_date,archived_at,updated_at FROM pool_bookings ORDER BY weekday,time',
  );
  const findBookingStatement = database.prepare(
    'SELECT id,child_id,coach_id,weekday,time,start_date,end_date,archived_at,updated_at FROM pool_bookings WHERE id=?',
  );
  const insertBookingStatement = database.prepare(
    `INSERT INTO pool_bookings(id,child_id,coach_id,weekday,time,start_date,end_date,archived_at,updated_at)
     VALUES(?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET child_id=excluded.child_id,coach_id=excluded.coach_id,weekday=excluded.weekday,
       time=excluded.time,start_date=excluded.start_date,end_date=excluded.end_date,archived_at=excluded.archived_at,
       updated_at=excluded.updated_at`,
  );
  const selectSessionsForMonthStatement = database.prepare(
    'SELECT booking_id,date,status,updated_at FROM pool_sessions WHERE date>=? AND date<?',
  );
  const upsertSessionStatement = database.prepare(
    `INSERT INTO pool_sessions(booking_id,date,status,updated_at) VALUES(?,?,?,?)
     ON CONFLICT(booking_id,date) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at`,
  );
  const deleteSessionStatement = database.prepare('DELETE FROM pool_sessions WHERE booking_id=? AND date=?');
  const findClosingStatement = database.prepare('SELECT month,closed_at FROM pool_closings WHERE month=?');
  const upsertClosingStatement = database.prepare(
    `INSERT INTO pool_closings(month,closed_at) VALUES(?,?)
     ON CONFLICT(month) DO UPDATE SET closed_at=excluded.closed_at`,
  );

  /** @param {{ includeArchived?: boolean }} [options] @returns {PoolBooking[]} */
  function listBookings({ includeArchived = false } = {}) {
    const rows = selectBookingsStatement.all().map(toBooking);
    return includeArchived ? rows : rows.filter(booking => !booking.archivedAt);
  }

  /** @param {string} id @returns {PoolBooking | null} */
  function findBooking(id) {
    const row = findBookingStatement.get(id);
    return row ? toBooking(row) : null;
  }

  /** @param {PoolBooking} booking */
  function saveBooking(booking) {
    insertBookingStatement.run(
      booking.id,
      booking.childId,
      booking.coachId,
      booking.weekday,
      booking.time,
      booking.startDate,
      booking.endDate,
      booking.archivedAt,
      booking.updatedAt,
    );
    return /** @type {PoolBooking} */ (findBooking(booking.id));
  }

  /** @param {string} month YYYY-MM @returns {PoolSession[]} */
  function sessionsForMonth(month) {
    const [year, monthNumber] = month.split('-').map(Number);
    const start = `${month}-01`;
    const end = monthNumber === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;
    return selectSessionsForMonthStatement.all(start, end).map(toSession);
  }

  /**
   * O singură tranzacție pentru tot lotul (precedentul attendance) — `status: null` șterge rândul.
   * @param {{ bookingId: string, date: string, status: import('../pool.types.d.mts').PoolSessionStatus | null }[]} changes
   * @param {() => string} now
   * @param {(change: { kind: 'pool_sessions', id: string, payload: PoolSession | null }) => void} [onChange]
   */
  function applySessionChanges(changes, now, onChange) {
    database.exec('BEGIN IMMEDIATE');
    try {
      const saved = [];
      const removed = [];
      for (const change of changes) {
        const outboxId = `${change.bookingId}|${change.date}`;
        if (change.status === null) {
          deleteSessionStatement.run(change.bookingId, change.date);
          removed.push({ bookingId: change.bookingId, date: change.date });
          onChange?.({ kind: 'pool_sessions', id: outboxId, payload: null });
        } else {
          const updatedAt = now();
          upsertSessionStatement.run(change.bookingId, change.date, change.status, updatedAt);
          const session = { bookingId: change.bookingId, date: change.date, status: change.status, updatedAt };
          saved.push(session);
          onChange?.({ kind: 'pool_sessions', id: outboxId, payload: session });
        }
      }
      database.exec('COMMIT');
      return { saved, removed };
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  /** @param {string} month @returns {import('../pool.types.d.mts').PoolClosing | null} */
  function closingFor(month) {
    const row = findClosingStatement.get(month);
    return row ? { month: /** @type {any} */ (row).month, closedAt: /** @type {any} */ (row).closed_at } : null;
  }

  /** @param {string} month @param {string} closedAt */
  function saveClosing(month, closedAt) {
    upsertClosingStatement.run(month, closedAt);
  }

  return { listBookings, findBooking, saveBooking, sessionsForMonth, applySessionChanges, closingFor, saveClosing };
}

/** @typedef {ReturnType<typeof createPoolRepository>} PoolRepository */
