import { isWorkingDay } from '#shared/domain/holidays-md.mjs';
import { shiftDays, daysBetween } from '#shared/domain/calendar-month.mjs';
import type { Leave, LeaveDaysRemaining, OverlappingLeaveWarning } from './personal.types';
import type { GroupTeamMember } from '@contracts/record-types.mjs';

/** Toate zilele din `[from, to]`, inclusiv capetele. */
function datesInRange(from: string, to: string): string[] {
  const span = daysBetween(from, to);
  return Array.from({ length: span + 1 }, (_, index) => shiftDays(from, index));
}

/** Zilele lucrătoare dintr-un concediu — folosite atât la Pontaj cât și la zilele rămase. */
export function leaveWorkingDays(leave: Pick<Leave, 'from' | 'to'>): number {
  return datesInRange(leave.from, leave.to).filter(isWorkingDay).length;
}

/**
 * Zilele rămase din concediul anual (decizia din întrebarea 4): concediile planificate scad
 * din rămas la fel ca cele deja consumate — un concediu planificat e capacitate rezervată.
 * `leaves` trebuie deja filtrat pe angajat și an de către apelant.
 */
export function leaveDaysRemaining({
  leaves,
  annualLeaveDays,
}: {
  leaves: Pick<Leave, 'type' | 'planned' | 'from' | 'to'>[];
  annualLeaveDays: number;
}): LeaveDaysRemaining {
  const coLeaves = leaves.filter(leave => leave.type === 'CO');
  const used = coLeaves.filter(leave => !leave.planned).reduce((sum, leave) => sum + leaveWorkingDays(leave), 0);
  const planned = coLeaves.filter(leave => leave.planned).reduce((sum, leave) => sum + leaveWorkingDays(leave), 0);
  return { used, planned, remaining: annualLeaveDays - used - planned };
}

/** Rândurile de pontaj generate de un concediu — un rând per zi lucrătoare din interval. */
export function timesheetRowsForLeave(leave: Leave): { date: string; code: Leave['type'] }[] {
  return datesInRange(leave.from, leave.to)
    .filter(isWorkingDay)
    .map(date => ({ date, code: leave.type }));
}

const MONTHS_RO = [
  'ianuarie',
  'februarie',
  'martie',
  'aprilie',
  'mai',
  'iunie',
  'iulie',
  'august',
  'septembrie',
  'octombrie',
  'noiembrie',
  'decembrie',
];

/** Ziua din an (1-indexată) a unei date — folosită pentru poziționarea barelor din Concedii (23f). */
export function dayOfYear(date: string): number {
  return daysBetween(`${date.slice(0, 4)}-01-01`, date) + 1;
}

/** Numărul de zile al unui an (365 sau 366) — cât de lată e pista din Concedii (23f). */
export function daysInYear(year: string): number {
  return daysBetween(`${year}-01-01`, `${Number(year) + 1}-01-01`);
}

/**
 * Poziția (stânga/lățime, în procente din pistă) a barei unui concediu în anul afișat — un concediu
 * poate începe sau se poate termina în afara anului (ex. 28 decembrie – 5 ianuarie), caz în care bara
 * se taie la marginea anului.
 */
export function leaveYearBar(leave: Pick<Leave, 'from' | 'to'>, year: string): { leftPct: number; widthPct: number } {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const from = leave.from < yearStart ? yearStart : leave.from;
  const to = leave.to > yearEnd ? yearEnd : leave.to;
  const total = daysInYear(year);
  const startDay = dayOfYear(from);
  const endDay = dayOfYear(to);
  return { leftPct: ((startDay - 1) / total) * 100, widthPct: ((endDay - startDay + 1) / total) * 100 };
}

/** „15–27 iulie” / „28 iulie – 3 august” — intervalul unui concediu, pentru avertizarea de suprapunere (23f). */
export function formatLeaveRange(from: string, to: string): string {
  const fromMonth = Number(from.slice(5, 7));
  const toMonth = Number(to.slice(5, 7));
  const fromDay = Number(from.slice(8, 10));
  const toDay = Number(to.slice(8, 10));
  if (fromMonth === toMonth) return `${fromDay}–${toDay} ${MONTHS_RO[fromMonth - 1]}`;
  return `${fromDay} ${MONTHS_RO[fromMonth - 1]} – ${toDay} ${MONTHS_RO[toMonth - 1]}`;
}

/** Concediile care se suprapun în timp pentru angajați din aceeași echipă de grupă (decizia 9j/23f). */
export function overlappingLeavesInGroup(
  leaves: Leave[],
  groups: { id: string; team?: GroupTeamMember[] }[],
): OverlappingLeaveWarning[] {
  const warnings: OverlappingLeaveWarning[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    const teamStaffIds = new Set((group.team ?? []).map(entry => entry.staffId));
    if (teamStaffIds.size < 2) continue;
    const groupLeaves = leaves.filter(leave => teamStaffIds.has(leave.staffId));

    for (let i = 0; i < groupLeaves.length; i += 1) {
      for (let j = i + 1; j < groupLeaves.length; j += 1) {
        const first = groupLeaves[i];
        const second = groupLeaves[j];
        if (first.staffId === second.staffId) continue;
        const overlapFrom = first.from > second.from ? first.from : second.from;
        const overlapTo = first.to < second.to ? first.to : second.to;
        if (overlapFrom > overlapTo) continue;

        const staffIds = [first.staffId, second.staffId].sort();
        const key = `${group.id}|${staffIds.join(',')}|${overlapFrom}|${overlapTo}`;
        if (seen.has(key)) continue;
        seen.add(key);
        warnings.push({ groupId: group.id, staffIds, from: overlapFrom, to: overlapTo });
      }
    }
  }

  return warnings;
}
