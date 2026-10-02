import { SENSITIVE_FIELDS } from '#shared/domain/record-schema.mjs';

/** 40b (PROMPT-8 §8.2): „Anulează" apare 10 secunde — serverul refuză orice cerere mai veche. */
export const UNDO_WINDOW_MS = 15_000;

/**
 * Regulile de eligibilitate pentru `POST /api/undo` (40b): doar în fereastra de 15 secunde de
 * la acțiune, doar de pe același calculator (ștampila sesiunii active la momentul acțiunii —
 * vezi `createAuditLogRepository`), doar dacă înregistrarea n-a mai fost modificată între timp
 * (comparată cu `entry.after`, nu cu revizia globală — o scriere oriunde altundeva în aplicație
 * nu trebuie să blocheze anularea unei acțiuni pe o altă înregistrare).
 * @param {{
 *   entry: { recordType: string | null, recordId: string | null, after: unknown, occurredAt: string, sessionToken: string | null } | null,
 *   now: Date,
 *   currentSessionToken: string | null,
 *   currentRecord: unknown,
 * }} params
 * @returns {{ ok: true } | { ok: false, message: string, status: number }}
 */
export function checkUndoEligibility({ entry, now, currentSessionToken, currentRecord }) {
  if (!entry) return { ok: false, message: 'Înregistrarea din istoric nu există.', status: 404 };
  if (entry.recordType === null || entry.recordId === null)
    return { ok: false, message: 'Acțiunea asta nu poate fi anulată.', status: 409 };
  const elapsedMs = now.getTime() - new Date(entry.occurredAt).getTime();
  if (elapsedMs < 0 || elapsedMs > UNDO_WINDOW_MS)
    return { ok: false, message: 'Fereastra de anulare a trecut.', status: 409 };
  if (!currentSessionToken || entry.sessionToken !== currentSessionToken)
    return { ok: false, message: 'Anularea e permisă doar de pe același calculator.', status: 403 };
  if (JSON.stringify(currentRecord ?? null) !== JSON.stringify(entry.after ?? null))
    return { ok: false, message: 'S-a modificat între timp.', status: 409 };
  return { ok: true };
}

/**
 * Valoarea de restaurat la anulare, cu câmpurile sensibile (`children`/`visits.healthNotes`)
 * preluate din înregistrarea CURENTĂ, nu din `before` — istoricul le ține redactate
 * (`redactSensitiveFields`), deci o restaurare literală ar scrie șablonul „[date medicale]”
 * peste nota reală. Niciuna dintre cele 6 acțiuni anulabile (achitare, cheltuială, avans, copil
 * nou, mutare în grupă, arhivare) nu modifică notele medicale — păstrarea valorii curente e
 * mereu corectă, nu doar „mai puțin greșită”.
 * @param {string} recordType
 * @param {Record<string, unknown>} before
 * @param {Record<string, unknown> | null} currentRecord
 */
export function restoreValueForUndo(recordType, before, currentRecord) {
  const sensitiveFields = SENSITIVE_FIELDS[recordType];
  if (!sensitiveFields?.length || !currentRecord) return before;
  const restored = { ...before };
  for (const field of sensitiveFields) if (field in currentRecord) restored[field] = currentRecord[field];
  return restored;
}
