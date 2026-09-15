/** @typedef {import('#shared/contracts/record-types.mjs').Visit} Visit */

// Precompletarea fișei copilului la „Înscrie copilul”: câmpurile vizitei devin
// punctul de plecare al formularului, ca operatorul să nu le retasteze.
/**
 * @param {Visit} visit
 * @returns {Record<string, unknown>}
 */
export function buildChildPrefill(visit) {
  const noteLines = [];
  if (visit.source && visit.source.trim()) noteLines.push(`Sursă: ${visit.source.trim()}`);
  if (visit.postVisitNotes && visit.postVisitNotes.trim()) noteLines.push(visit.postVisitNotes.trim());
  return {
    name: visit.name,
    birthDate: visit.birthDate,
    parent: visit.parent,
    phone: visit.phone,
    parent2: visit.parent2,
    phone2: visit.phone2,
    groupId: visit.desiredGroupId,
    attendanceDate: visit.desiredStartDate,
    healthNotes: visit.healthNotes,
    notes: noteLines.join('\n'),
  };
}
