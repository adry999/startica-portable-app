import { isoDateOf, shiftDays } from '#shared/domain/calendar-month.mjs';

/** @typedef {import('../sms-notify.types.mjs').SmsLogEntry} SmsLogEntry */
/** @typedef {import('../sms-notify.types.mjs').NewSmsLogEntry} NewSmsLogEntry */
/** @typedef {import('../sms-notify.types.mjs').SmsMonthlyStats} SmsMonthlyStats */
/** @typedef {import('../sms-notify.types.mjs').SmsLastNotified} SmsLastNotified */
/** @typedef {import('../sms-notify.types.mjs').SmsMonthlyBreakdown} SmsMonthlyBreakdown */

export const SMS_LOG_RETENTION_DAYS = 365;

// Un singur tabel camelCase -> coloană snake_case: insert/update/select citesc de aici, deci un
// nume de câmp nou din NewSmsLogEntry ajunge automat persistat, fără cod repetat per coloană.
const COLUMN_BY_FIELD = {
  createdAt: 'created_at',
  childId: 'child_id',
  recipientName: 'recipient_name',
  childName: 'child_name',
  phone: 'phone',
  text: 'text',
  templateId: 'template_id',
  templateName: 'template_name',
  month: 'month',
  source: 'source',
  characters: 'characters',
  segments: 'segments',
  encoding: 'encoding',
  cost: 'cost',
  status: 'status',
  providerId: 'provider_id',
  providerStatus: 'provider_status',
  providerError: 'provider_error',
  statusCheckedAt: 'status_checked_at',
  batchId: 'batch_id',
};
const FIELDS = Object.keys(COLUMN_BY_FIELD);
const COLUMNS = FIELDS.map(field => COLUMN_BY_FIELD[field]).join(',');
const normalize = value => (value === undefined ? null : value);

/** @returns {SmsLogEntry} */
const toEntry = row => {
  const entry = { id: row.id };
  for (const field of FIELDS) entry[field] = row[COLUMN_BY_FIELD[field]];
  return /** @type {SmsLogEntry} */ (entry);
};

/** @param {Date} now @returns {[string, string]} */
function localMonthBounds(now) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return [start.toISOString(), end.toISOString()];
}

// O dată calendaristică (fără oră) e mereu ora locală a instalării (Europe/Chisinau), nu UTC:
// un literal ISO fără „Z"/offset e interpretat de Date ca oră locală, deci .toISOString() dă
// exact instantul UTC al miezului nopții local — spre diferență de `${zi}T00:00:00.000Z`.
/** @param {string} dateStr format YYYY-MM-DD @returns {string} */
const localMidnightIso = dateStr => new Date(`${dateStr}T00:00:00`).toISOString();

/** @param {import('node:sqlite').DatabaseSync} database */
export function createSmsLogRepository(database) {
  const insertStatement = database.prepare(
    `INSERT INTO sms_log(${COLUMNS}) VALUES(${FIELDS.map(() => '?').join(',')})`,
  );
  const selectOne = database.prepare(`SELECT id,${COLUMNS} FROM sms_log WHERE id=?`);
  const monthlyStatsStatement = database.prepare(
    `SELECT
       SUM(CASE WHEN status!='failed' THEN 1 ELSE 0 END) AS sent,
       SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
       SUM(CASE WHEN status!='failed' THEN segments ELSE 0 END) AS segmentsSum
     FROM sms_log WHERE created_at>=? AND created_at<?`,
  );
  // rowid ca tie-break: created_at poate fi identic pe două rânduri, iar rowid crește strict cu ordinea reală de inserare.
  const lastUnitCostStatement = database.prepare(
    'SELECT cost,segments FROM sms_log WHERE cost IS NOT NULL AND segments>0 ORDER BY created_at DESC, rowid DESC LIMIT 1',
  );
  const lastNotifiedByChildStatement = database.prepare(
    `SELECT child_id,created_at,status,month,template_name FROM sms_log
     WHERE child_id IS NOT NULL AND status!='failed' AND source!='test'
     ORDER BY created_at DESC, rowid DESC`,
  );
  const pendingDeliveryStatement = database.prepare(
    `SELECT id,${COLUMNS} FROM sms_log WHERE status='sent' AND provider_id IS NOT NULL ORDER BY created_at DESC, rowid DESC LIMIT ?`,
  );
  const listSinceStatement = database.prepare(
    `SELECT id,${COLUMNS} FROM sms_log WHERE created_at>=? ORDER BY created_at DESC, rowid DESC`,
  );
  // Gruparea pe lună se face în JS, nu în SQL: `created_at` e UTC, iar luna afișată e cea locală
  // (Europe/Chisinau) — un `substr`/`strftime` pe coloană ar grupa greșit mesajele trimise în
  // fereastra UTC↔local de 2-3h din jurul miezului nopții.
  const monthlyBreakdownRowsStatement = database.prepare('SELECT created_at,status,segments FROM sms_log');
  const usageCountByTemplateStatement = database.prepare(
    `SELECT template_id,COUNT(*) AS count FROM sms_log
     WHERE template_id IS NOT NULL AND status!='failed' GROUP BY template_id`,
  );
  const markUnknownStatement = database.prepare(
    "UPDATE sms_log SET status='unknown' WHERE status='sent' AND created_at<?",
  );
  const expireStatement = database.prepare(
    "UPDATE sms_log SET text='',phone='' WHERE created_at<? AND (text!='' OR phone!='')",
  );
  const listByBatchStatement = database.prepare(`SELECT id,${COLUMNS} FROM sms_log WHERE batch_id=? ORDER BY id ASC`);

  /** @param {NewSmsLogEntry} entry @returns {number} */
  function insert(entry) {
    const values = FIELDS.map(field => normalize(entry[field]));
    return Number(insertStatement.run(...values).lastInsertRowid);
  }

  /** @param {number} id @param {Partial<NewSmsLogEntry>} patch */
  function update(id, patch) {
    const keys = Object.keys(patch);
    if (keys.length === 0) return;
    for (const key of keys) {
      if (!Object.hasOwn(COLUMN_BY_FIELD, key)) throw new Error(`Câmp necunoscut în patch sms_log: ${key}`);
    }
    const assignments = keys.map(key => `${COLUMN_BY_FIELD[key]}=?`).join(',');
    const values = keys.map(key => normalize(patch[key]));
    database.prepare(`UPDATE sms_log SET ${assignments} WHERE id=?`).run(...values, id);
  }

  /** @param {number} id @returns {SmsLogEntry | null} */
  function find(id) {
    const row = selectOne.get(id);
    return row ? toEntry(row) : null;
  }

  /** @param {Date} now @returns {SmsMonthlyStats} */
  function monthlyStats(now) {
    const [start, end] = localMonthBounds(now);
    // Cast: agregatul SUM întoarce mereu exact un rând (eventual cu coloane null), niciodată undefined.
    const row = /** @type {any} */ (monthlyStatsStatement.get(start, end));
    return {
      sentThisMonth: Number(row.sent ?? 0),
      failedThisMonth: Number(row.failed ?? 0),
      segmentsThisMonth: Number(row.segmentsSum ?? 0),
    };
  }

  /** @returns {number} */
  function lastUnitCost() {
    const row = /** @type {any} */ (lastUnitCostStatement.get());
    return row ? Number(row.cost) / Number(row.segments) : 0.3;
  }

  /** @returns {Record<string, SmsLastNotified>} */
  function lastNotifiedByChild() {
    /** @type {Record<string, SmsLastNotified>} */
    const result = {};
    // Rândurile vin ordonate descrescător: primul rând văzut pentru un copil e deja cel mai recent.
    for (const row of /** @type {any[]} */ (lastNotifiedByChildStatement.all())) {
      if (row.child_id in result) continue;
      result[row.child_id] = {
        at: row.created_at,
        status: row.status,
        month: row.month,
        templateName: row.template_name,
      };
    }
    return result;
  }

  /** @param {number} [limit] @returns {SmsLogEntry[]} */
  function pendingDelivery(limit = 50) {
    return pendingDeliveryStatement.all(limit).map(toEntry);
  }

  /** @param {string} cutoffIso @returns {SmsLogEntry[]} */
  function listSince(cutoffIso) {
    return listSinceStatement.all(cutoffIso).map(toEntry);
  }

  /** @returns {SmsMonthlyBreakdown[]} */
  function monthlyBreakdown() {
    /** @type {Map<string, { sent: number, segments: number, failed: number }>} */
    const totalsByMonth = new Map();
    for (const row of /** @type {any[]} */ (monthlyBreakdownRowsStatement.all())) {
      const month = isoDateOf(new Date(row.created_at)).slice(0, 7);
      const totals = totalsByMonth.get(month) ?? { sent: 0, segments: 0, failed: 0 };
      if (row.status === 'failed') totals.failed += 1;
      else {
        totals.sent += 1;
        totals.segments += row.segments;
      }
      totalsByMonth.set(month, totals);
    }
    return [...totalsByMonth.entries()]
      .sort(([monthA], [monthB]) => (monthA < monthB ? 1 : -1))
      .map(([month, totals]) => ({ month, ...totals }));
  }

  /** @returns {Record<string, number>} */
  function usageCountByTemplate() {
    /** @type {Record<string, number>} */
    const result = {};
    for (const row of /** @type {any[]} */ (usageCountByTemplateStatement.all()))
      result[row.template_id] = Number(row.count);
    return result;
  }

  /** @param {string} cutoffIso @returns {number} */
  function markUnknownOlderThan(cutoffIso) {
    return Number(markUnknownStatement.run(cutoffIso).changes);
  }

  /** @param {string} todayStr @returns {{ expired: number }} */
  function expireOldEntries(todayStr) {
    // Cutoff-ul e ziua de dinaintea celei „exact retenția”, ca un rând vechi de exact
    // SMS_LOG_RETENTION_DAYS zile (indiferent de ora din zi) să pice sub „<”, nu deasupra lui.
    const cutoff = localMidnightIso(shiftDays(todayStr, -(SMS_LOG_RETENTION_DAYS - 1)));
    const { changes } = expireStatement.run(cutoff);
    return { expired: Number(changes) };
  }

  /** @param {string} batchId @returns {SmsLogEntry[]} */
  function listByBatch(batchId) {
    return listByBatchStatement.all(batchId).map(toEntry);
  }

  return {
    insert,
    update,
    find,
    monthlyStats,
    lastUnitCost,
    lastNotifiedByChild,
    pendingDelivery,
    listSince,
    monthlyBreakdown,
    listByBatch,
    usageCountByTemplate,
    markUnknownOlderThan,
    expireOldEntries,
  };
}

/** @typedef {ReturnType<typeof createSmsLogRepository>} SmsLogRepository */
