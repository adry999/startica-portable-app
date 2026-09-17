/** @typedef {import('#shared/contracts/record-types.mjs').Visit} Visit */
/** @typedef {import('#shared/contracts/record-types.mjs').VisitStatus} VisitStatus */

/** @type {Record<VisitStatus, VisitStatus[]>} */
const NEXT_STATUSES = {
  Programată: ['Efectuată', 'Neprezentată', 'Renunțat'],
  Efectuată: ['Renunțat'],
  Neprezentată: ['Renunțat'],
  Renunțat: [],
  Înscris: [],
};

/**
 * @param {VisitStatus} status
 * @returns {VisitStatus[]}
 */
export function allowedNextStatuses(status) {
  return NEXT_STATUSES[status] ?? [];
}

// Reprogramarea repornește vizita ca `Programată`, din orice statut în afară de `Înscris`
// (o vizită înscrisă a devenit deja fișa unui copil).
/**
 * @param {Visit} visit
 * @param {{ date: string, time: string }} schedule
 * @param {string} now
 * @returns {Visit}
 */
export function rescheduleVisit(visit, { date, time }, now) {
  if (visit.status === 'Înscris') throw new Error('Vizita a fost deja înscrisă; nu se mai poate reprograma.');
  return {
    ...visit,
    status: 'Programată',
    date,
    time,
    statusChangedAt: now,
    history: [...visit.history, { at: now, status: 'Programată', date, time }],
  };
}

/**
 * @param {Visit} visit
 * @param {VisitStatus} status
 * @param {string} now
 * @returns {Visit}
 */
export function applyVisitStatus(visit, status, now) {
  if (!allowedNextStatuses(visit.status).includes(status)) {
    throw new Error(`Tranziție de statut invalidă: ${visit.status} → ${status}.`);
  }
  return {
    ...visit,
    status,
    statusChangedAt: now,
    history: [...visit.history, { at: now, status, date: visit.date, time: visit.time }],
  };
}
