import { fail } from '#core/server/errors/domain-error.mjs';
import { normalizePersonalRecord } from '../domain/personal-schema.mjs';
import { timesheetRowsForLeave, overlappingLeavesInGroup } from '../domain/leave-days.mjs';

/** @typedef {import('../personal.types.d.mts').Leave} Leave */
/** @typedef {import('./personal.repository.mjs').PersonalRepository} PersonalRepository */

/** @param {string} staffId @param {string} date */
const timesheetRowId = (staffId, date) => `TS-${staffId}-${date}`;

/** @param {Pick<Leave, 'from' | 'to'>} left @param {Pick<Leave, 'from' | 'to'>} right */
const leavesOverlap = (left, right) => left.from <= right.to && right.from <= left.to;

/**
 * Scrierea/ștergerea unui concediu ține pontajul consistent: rândurile cu `leaveId` sunt
 * scrise/șterse în aceeași tranzacție `kinds.transaction`, niciodată separat. Suprapunerea
 * altui concediu AL ACELUIAȘI angajat e o eroare (400); suprapunerea între angajați diferiți
 * din aceeași grupă e doar un avertisment (23f), calculat aici din echipa grupei.
 * @param {{ repository: PersonalRepository, listGroups: () => { id: string, team?: { staffId: string }[] }[] }} dependencies
 */
export function createLeavesService({ repository, listGroups }) {
  /** @param {string} year @param {string[] | null} [staffIds] */
  function leavesForYear(year, staffIds = null) {
    const leaves = repository.leavesForYear(year, staffIds);
    const warnings = overlappingLeavesInGroup(leaves, listGroups());
    return { leaves, warnings };
  }

  /** @param {unknown} input @returns {Leave} */
  function saveLeave(input) {
    const normalized = normalizePersonalRecord('leaves', input);
    const existing = repository.kinds.find('leaves', normalized.id);
    const others = repository.kinds
      .list('leaves')
      .filter(leave => leave.staffId === normalized.staffId && leave.id !== normalized.id);
    if (others.some(leave => leavesOverlap(leave, normalized)))
      fail('Angajatul are deja un concediu înregistrat în această perioadă.');
    return repository.kinds.transaction(() => {
      if (existing)
        for (const row of timesheetRowsForLeave(existing))
          repository.kinds.remove('timesheet', timesheetRowId(row.staffId, row.date));
      repository.kinds.save('leaves', normalized);
      for (const row of timesheetRowsForLeave(normalized))
        repository.kinds.save('timesheet', { id: timesheetRowId(row.staffId, row.date), ...row });
      return normalized;
    });
  }

  /** @param {string} id @returns {Leave} */
  function removeLeave(id) {
    const existing = repository.kinds.find('leaves', id);
    if (!existing) fail('Concediul nu mai există.', 409);
    return repository.kinds.transaction(() => {
      for (const row of timesheetRowsForLeave(existing))
        repository.kinds.remove('timesheet', timesheetRowId(row.staffId, row.date));
      repository.kinds.remove('leaves', id);
      return existing;
    });
  }

  return { leavesForYear, saveLeave, removeLeave };
}
