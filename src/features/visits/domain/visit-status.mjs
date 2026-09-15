// Forma minimă din §3.1 a specului, folosită doar în domain/visits; S1 aduce tipul canonic în record-types.d.mts.
/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   phone: string,
 *   status: string,
 *   date: string,
 *   time: string,
 *   history: { at: string, status: string, date: string, time: string }[],
 *   statusChangedAt: string,
 *   healthNotes?: string,
 *   archived?: boolean,
 * }} Visit
 */

const NEXT_STATUSES = {
  Programată: ['Efectuată', 'Neprezentată', 'Renunțat'],
  Efectuată: ['Renunțat'],
  Neprezentată: ['Renunțat'],
  Renunțat: [],
  Înscris: [],
};

/**
 * @param {string} status
 * @returns {string[]}
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
 * @param {string} status
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
