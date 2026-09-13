export function createRecordingAuditTrail() {
  /** @type {import('#shared/contracts/audit-trail.mjs').AuditChange[]} */
  const changes = [];
  return {
    recordChange: change => void changes.push(structuredClone(change)),
    changes,
  };
}
