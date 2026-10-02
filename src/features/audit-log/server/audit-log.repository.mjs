import { fail } from '#core/server/errors/domain-error.mjs';
import { redactSensitiveFields, SENSITIVE_FIELDS } from '#shared/domain/record-schema.mjs';

export const AUDIT_PAGE_SIZE = 100;

// 45a (PROMPT-8 §14): „Notele medicale: doar «notă medicală modificată», fără conținut.”
// `redactSensitiveFields` înlocuiește orice valoare ne-goală cu același șablon — dacă nota s-a
// schimbat dintr-un text ne-gol în altul, ambele părți redactează identic și `listChangedFields`
// (webapp) le vede „neschimbate”, pierzând exact semnalul cerut aici. Marcajul de mai jos
// păstrează acel semnal, fără conținut: doar partea `after` devine distinctă de `before` când
// valorile brute (dinainte de redactare) chiar diferă — ecranul Istoric arată apoi un singur text,
// nu un „înainte → după” (vezi toRow/AuditRow în webapp).
const SENSITIVE_CHANGED_MARK = '[date medicale: modificat]';

/**
 * Mutează `redactedAfter` în loc — apelat după `redactSensitiveFields`, cât timp valorile brute
 * (`before`/`after`, neredactate) mai sunt la îndemână. `before`/`after` sunt `unknown` ca în
 * `AuditChange` (audit-trail.d.mts) — orice formă de intrare poate ajunge în `recordChange`.
 * @param {string | null} recordType
 * @param {unknown} before
 * @param {unknown} after
 * @param {Record<string, unknown> | null} redactedAfter
 */
function markSensitiveFieldChanges(recordType, before, after, redactedAfter) {
  const fields = recordType ? SENSITIVE_FIELDS[recordType] : null;
  if (!before || typeof before !== 'object' || !after || typeof after !== 'object' || !redactedAfter || !fields?.length)
    return;
  for (const field of fields) {
    const previous = /** @type {Record<string, unknown>} */ (before)[field];
    const next = /** @type {Record<string, unknown>} */ (after)[field];
    if (previous && next && previous !== next) redactedAfter[field] = SENSITIVE_CHANGED_MARK;
  }
}

/** @typedef {import('../audit-log.types.mjs').AuditChange} AuditChange */
/** @typedef {import('../audit-log.types.mjs').AuditEntry} AuditEntry */
/** @typedef {import('../audit-log.types.mjs').AuditPage} AuditPage */

const ENTRY_COLUMNS = 'id,created_at,action,kind,record_id,before_json,after_json';
const ENTRY_COLUMNS_WITH_SESSION = `${ENTRY_COLUMNS},session_token`;

/** @param {unknown} value */
const serialize = value => (value == null ? null : JSON.stringify(value));
/** @param {string | null} text */
const deserialize = text => (text == null ? null : JSON.parse(text));

/**
 * @param {import('node:sqlite').DatabaseSync} database
 * @param {{ sessionToken?: string | null }} [options] Ștampilează fiecare intrare nouă cu
 *   sesiunea activă a filialei (40b — create-branch-context.mjs), citită de `findById` pentru
 *   garda „doar de pe același calculator" a `POST /api/undo`. Opțional — instanța folosită de
 *   sincronizare (comun) nu are nevoie de ea, nu are nimic de anulat local.
 */
export function createAuditLogRepository(database, { sessionToken = null } = {}) {
  const insertChange = database.prepare(
    'INSERT INTO audit_changes(created_at,action,kind,record_id,before_json,after_json,session_token) VALUES(?,?,?,?,?,?,?)',
  );
  // Un rând peste pagină arată dacă mai urmează ceva, fără COUNT pe tot jurnalul.
  const selectNewest = database.prepare(`SELECT ${ENTRY_COLUMNS} FROM audit_changes ORDER BY id DESC LIMIT ?`);
  const selectOlderThan = database.prepare(
    `SELECT ${ENTRY_COLUMNS} FROM audit_changes WHERE id < ? ORDER BY id DESC LIMIT ?`,
  );
  const selectById = database.prepare(`SELECT ${ENTRY_COLUMNS_WITH_SESSION} FROM audit_changes WHERE id=?`);

  /**
   * @param {AuditChange} change
   * @returns {number} id-ul intrării create — folosit de UndoToast (40b) ca să ceară anularea ei.
   */
  function recordChange({
    action,
    recordType = null,
    recordId = null,
    before = null,
    after = null,
    occurredAt = new Date(),
  }) {
    if (typeof action !== 'string' || !action.trim()) fail('Acțiunea din istoric lipsește.');
    // Un singur punct de redactare, ca să acopere orice cale de scriere (editare,
    // înscriere, restaurare, import); recordType null (intrări de configurare) nu are câmpuri sensibile.
    const redactedAfter = redactSensitiveFields(recordType, after);
    markSensitiveFieldChanges(recordType, before, after, redactedAfter);
    const result = insertChange.run(
      occurredAt.toISOString(),
      action,
      recordType,
      recordId,
      serialize(redactSensitiveFields(recordType, before)),
      serialize(redactedAfter),
      sessionToken,
    );
    return Number(result.lastInsertRowid);
  }

  /**
   * @param {number} id
   * @returns {(AuditEntry & { sessionToken: string | null }) | null} 40b: `POST /api/undo` citește
   *   o singură intrare — `sessionToken` nu e expus de `readPage`/`AuditEntry` (nu privește ecranul
   *   Istoric, doar garda de anulare).
   */
  function findById(id) {
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    const row = selectById.get(id);
    return row ? { ...toAuditEntry(row), sessionToken: /** @type {string | null} */ (row.session_token) } : null;
  }

  /**
   * Cursor după id, nu OFFSET: o modificare salvată între două pagini nu deplasează rândurile deja afișate.
   * @param {{ beforeEntryId: number | null }} cursor
   * @returns {AuditPage}
   */
  function readPage({ beforeEntryId }) {
    if (beforeEntryId !== null && !(Number.isSafeInteger(beforeEntryId) && beforeEntryId > 0))
      fail('Poziția din istoric este invalidă.');
    const rows =
      beforeEntryId === null
        ? selectNewest.all(AUDIT_PAGE_SIZE + 1)
        : selectOlderThan.all(beforeEntryId, AUDIT_PAGE_SIZE + 1);
    const hasMore = rows.length > AUDIT_PAGE_SIZE;
    const entries = rows.slice(0, AUDIT_PAGE_SIZE).map(toAuditEntry);
    return { entries, nextBeforeEntryId: hasMore ? entries[entries.length - 1].id : null };
  }

  /**
   * Istoricul unei singure înregistrări (45a, PROMPT-8 §14) — fișa unui copil arată și mutările
   * ei de grupă (tot pe `kind:'children', recordId:childId`) cât și achitările lui, de-aceea
   * `scope` acceptă mai multe perechi (tip, id), nu doar una singură. `recordType` poate fi
   * `null` (personalul se salvează fără `kind`, vezi `personal.routes.mjs`) — `IS`, nu `=`, ca
   * SQLite să compare NULL corect. Același cursor pe `id` ca `readPage`, ca o modificare nouă
   * să nu dubleze rânduri deja afișate.
   * @param {{ scope: { recordType: string | null, recordId: string }[], beforeEntryId: number | null }} params
   * @returns {AuditPage}
   */
  function readForScope({ scope, beforeEntryId }) {
    if (!Array.isArray(scope) || scope.length === 0) fail('Scope-ul istoricului lipsește.');
    for (const entry of scope)
      if (!entry || (entry.recordType !== null && typeof entry.recordType !== 'string') || !entry.recordId)
        fail('Scope-ul istoricului este invalid.');
    if (beforeEntryId !== null && !(Number.isSafeInteger(beforeEntryId) && beforeEntryId > 0))
      fail('Poziția din istoric este invalidă.');

    const scopeClause = scope.map(() => '(kind IS ? AND record_id = ?)').join(' OR ');
    const scopeParams = scope.flatMap(({ recordType, recordId }) => [recordType, recordId]);
    const cursorClause = beforeEntryId === null ? '' : ' AND id < ?';
    const statement = database.prepare(
      `SELECT ${ENTRY_COLUMNS} FROM audit_changes WHERE (${scopeClause})${cursorClause} ORDER BY id DESC LIMIT ?`,
    );
    const params =
      beforeEntryId === null
        ? [...scopeParams, AUDIT_PAGE_SIZE + 1]
        : [...scopeParams, beforeEntryId, AUDIT_PAGE_SIZE + 1];
    const rows = statement.all(...params);
    const hasMore = rows.length > AUDIT_PAGE_SIZE;
    const entries = rows.slice(0, AUDIT_PAGE_SIZE).map(toAuditEntry);
    return { entries, nextBeforeEntryId: hasMore ? entries[entries.length - 1].id : null };
  }

  return { recordChange, readPage, readForScope, findById };
}

/** @returns {AuditEntry} */
function toAuditEntry(row) {
  return {
    id: row.id,
    occurredAt: row.created_at,
    action: row.action,
    recordType: row.kind,
    recordId: row.record_id,
    before: deserialize(row.before_json),
    after: deserialize(row.after_json),
  };
}
