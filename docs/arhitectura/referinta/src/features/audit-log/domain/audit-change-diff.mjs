/** @typedef {import('../audit-log.types.mjs').AuditFieldChange} AuditFieldChange */

/**
 * @param {Record<string, unknown> | null} before
 * @param {Record<string, unknown> | null} after
 * @returns {AuditFieldChange[]}
 */
export function listChangedFields(before, after) {
  const fields = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...fields]
    .filter(field => JSON.stringify(before?.[field]) !== JSON.stringify(after?.[field]))
    .map(field => ({ field, before: before?.[field] ?? null, after: after?.[field] ?? null }));
}
