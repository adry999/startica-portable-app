import { shiftDays } from '#shared/domain/calendar-month.mjs';
import { isWorkingDay } from '#shared/domain/holidays-md.mjs';

/** @typedef {import('../personal.types.d.mts').Leave} Leave */
/** @typedef {import('../personal.types.d.mts').LeaveDaysRemaining} LeaveDaysRemaining */
/** @typedef {import('../personal.types.d.mts').OverlappingLeaveWarning} OverlappingLeaveWarning */
/** @typedef {import('../personal.types.d.mts').TimesheetRow} TimesheetRow */
/** @typedef {{ id: string, team?: { staffId: string }[] }} GroupWithTeam */

/**
 * Zilele lucrătoare dintr-un concediu, inclusiv extremele — sursă comună pentru
 * consumul din zilele rămase și pentru rândurile de pontaj generate.
 * @param {Pick<Leave, 'from' | 'to'>} leave
 * @returns {string[]}
 */
export function leaveWorkingDays(leave) {
  const dates = [];
  for (let date = leave.from; date <= leave.to; date = shiftDays(date, 1)) if (isWorkingDay(date)) dates.push(date);
  return dates;
}

/**
 * Zilele rămase de concediu de odihnă (CO) ale anului — un concediu planificat
 * consumă la fel ca unul deja luat (întrebarea 4 din plan: „14 din 28 · 7 planificate”).
 * @param {{ staffId: string, year: string, leaves: Leave[], annualLeaveDays: number }} input
 * @returns {LeaveDaysRemaining}
 */
export function leaveDaysRemaining({ staffId, year, leaves, annualLeaveDays }) {
  const ofStaffThisYearCO = leaves.filter(
    leave => leave.staffId === staffId && leave.type === 'CO' && leave.from.slice(0, 4) === year,
  );
  const used = ofStaffThisYearCO
    .filter(leave => !leave.planned)
    .reduce((sum, leave) => sum + leaveWorkingDays(leave).length, 0);
  const planned = ofStaffThisYearCO
    .filter(leave => leave.planned)
    .reduce((sum, leave) => sum + leaveWorkingDays(leave).length, 0);
  return { used, planned, remaining: annualLeaveDays - used - planned };
}

/**
 * Rândurile de pontaj pe care le scrie un concediu, una per zi lucrătoare a perioadei.
 * @param {Leave} leave
 * @returns {Pick<TimesheetRow, 'staffId' | 'date' | 'code' | 'leaveId'>[]}
 */
export function timesheetRowsForLeave(leave) {
  return leaveWorkingDays(leave).map(date => ({ staffId: leave.staffId, date, code: leave.type, leaveId: leave.id }));
}

/**
 * Două concedii ale unor angajați din aceeași echipă de grupă, cu perioade care se
 * intersectează — raportate o singură dată per pereche/perioadă (decizia 12, testul din plan).
 * @param {Leave[]} leaves
 * @param {GroupWithTeam[]} groups
 * @returns {OverlappingLeaveWarning[]}
 */
export function overlappingLeavesInGroup(leaves, groups) {
  const warnings = [];
  const seen = new Set();
  for (const group of groups) {
    const teamStaffIds = new Set((group.team ?? []).map(member => member.staffId));
    const groupLeaves = leaves.filter(leave => teamStaffIds.has(leave.staffId));
    for (let i = 0; i < groupLeaves.length; i++) {
      for (let j = i + 1; j < groupLeaves.length; j++) {
        const left = groupLeaves[i];
        const right = groupLeaves[j];
        if (left.staffId === right.staffId) continue;
        const from = left.from > right.from ? left.from : right.from;
        const to = left.to < right.to ? left.to : right.to;
        if (from > to) continue;
        const staffIds = [left.staffId, right.staffId].sort();
        const key = `${group.id}|${staffIds.join(',')}|${from}|${to}`;
        if (seen.has(key)) continue;
        seen.add(key);
        warnings.push({ groupId: group.id, staffIds, from, to });
      }
    }
  }
  return warnings;
}
