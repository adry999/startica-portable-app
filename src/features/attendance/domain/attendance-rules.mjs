/** @typedef {import('../attendance.types.d.mts').AttendanceStatus} AttendanceStatus */
/** @typedef {import('../attendance.types.d.mts').AttendanceEntry} AttendanceEntry */
/** @typedef {import('../attendance.types.d.mts').AttendanceChange} AttendanceChange */
/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */

export const ATTENDANCE_STATUSES = /** @type {AttendanceStatus[]} */ (['present', 'absent', 'excused']);
export const EXCUSE_SUGGESTIONS = ['Boală', 'Concediu'];
export const REASON_MAX_LENGTH = 200;
export const MAX_CHANGES_PER_REQUEST = 500;

/** @param {string} childId @param {string} date @returns {string} */
export const attendanceKey = (childId, date) => `${childId}|${date}`;

const NEXT_STATUS = /** @type {Record<string, AttendanceStatus | null>} */ ({
  present: 'absent',
  absent: 'excused',
  excused: null,
});

/**
 * Ciclul unui clic pe placă: prezent → absent → motivat → nemarcat → prezent.
 * @param {AttendanceStatus | null} current
 * @returns {AttendanceStatus | null}
 */
export function nextAttendanceStatus(current) {
  return current === null ? 'present' : NEXT_STATUS[current];
}

/**
 * Un copil fără dată de frecventare și fără contract e considerat înscris (necunoscut ≠ neînscris).
 * Regula de retragere nu e în textul spec-ului, dar previne un copil retras rămas „nemarcat” la nesfârșit.
 * @param {Pick<Child, 'archived' | 'attendanceDate' | 'contractDate' | 'withdrawalDate'>} child
 * @param {string} date
 * @returns {boolean}
 */
export function isChildEnrolledOn(child, date) {
  if (child.archived) return false;
  const enrolledFrom = child.attendanceDate ?? child.contractDate ?? '';
  if (enrolledFrom > date) return false;
  if (child.withdrawalDate && child.withdrawalDate < date) return false;
  return true;
}

/**
 * @param {string[]} childIds
 * @param {ReadonlyMap<string, AttendanceEntry>} entriesByChild
 * @returns {{ present: number, absent: number, excused: number, unmarked: number }}
 */
export function summarizeDay(childIds, entriesByChild) {
  const summary = { present: 0, absent: 0, excused: 0, unmarked: 0 };
  for (const childId of childIds) {
    const status = entriesByChild.get(childId)?.status;
    if (status) summary[status]++;
    else summary.unmarked++;
  }
  return summary;
}

/**
 * „Toți nemarcații → prezenți”: doar copiii fără niciun marcaj în ziua respectivă.
 * @param {string[]} childIds
 * @param {ReadonlyMap<string, AttendanceEntry>} entriesByChild
 * @param {string} date
 * @returns {AttendanceChange[]}
 */
export function changesToMarkUnmarkedPresent(childIds, entriesByChild, date) {
  return childIds
    .filter(childId => !entriesByChild.has(childId))
    .map(childId => ({ childId, date, status: /** @type {AttendanceStatus} */ ('present') }));
}

/**
 * @param {AttendanceChange} change
 * @returns {AttendanceChange}
 */
export function normalizeAttendanceChange(change) {
  const reason = change.status === 'excused' ? (change.reason ?? '').trim().slice(0, REASON_MAX_LENGTH) : '';
  return { childId: change.childId, date: change.date, status: change.status, reason };
}
