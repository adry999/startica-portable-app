import { fail } from '#core/server/errors/domain-error.mjs';
import { redactSensitiveFields } from '#shared/domain/record-schema.mjs';

export const AUDIT_PAGE_SIZE = 100;

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
    const result = insertChange.run(
      occurredAt.toISOString(),
      action,
      recordType,
      recordId,
      serialize(redactSensitiveFields(recordType, before)),
      serialize(redactSensitiveFields(recordType, after)),
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

  return { recordChange, readPage, findById };
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
