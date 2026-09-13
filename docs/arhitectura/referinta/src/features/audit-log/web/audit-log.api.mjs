/** @typedef {import('../audit-log.types.mjs').AuditPage} AuditPage */

/** @param {{ requestJson: (path: string) => Promise<any> }} dependencies */
export function createAuditLogApi({ requestJson }) {
  return {
    /**
     * @param {number | null} beforeEntryId
     * @returns {Promise<AuditPage>}
     */
    fetchAuditPage: beforeEntryId =>
      requestJson(beforeEntryId === null ? '/api/audit' : `/api/audit?beforeEntryId=${beforeEntryId}`),
  };
}
