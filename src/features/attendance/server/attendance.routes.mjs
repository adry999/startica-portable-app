import { dateOK, monthOK, today as todayDefault } from '#shared/domain/calendar-month.mjs';
import { fail } from '#core/server/errors/domain-error.mjs';
import {
  ATTENDANCE_STATUSES,
  MAX_CHANGES_PER_REQUEST,
  normalizeAttendanceChange,
} from '../domain/attendance-rules.mjs';
import { createAttendanceRepository } from './attendance.repository.mjs';

/** @typedef {import('../attendance.types.d.mts').AttendanceRoutesDependencies} AttendanceRoutesDependencies */

const FUTURE_DATE_MESSAGE = 'Nu se marchează prezența pentru zile viitoare.';

/** @param {AttendanceRoutesDependencies} dependencies */
export function createAttendanceRoutes({ database, recordRepository, now = () => new Date(), today = todayDefault }) {
  const repository = createAttendanceRepository(database, { now });

  /** @param {string} groupId @returns {string[]} */
  function childIdsForGroup(groupId) {
    const { children } = recordRepository.readSnapshot();
    const matches = groupId === 'none' ? child => child.groupId === null : child => child.groupId === groupId;
    return children.filter(matches).map(child => child.id);
  }

  /** @param {{ url: URL }} request */
  function handleGet({ url }) {
    const date = url.searchParams.get('date');
    if (date) {
      if (!dateOK(date)) fail('Zi invalidă.');
      return { entries: repository.listByDate(date) };
    }
    const month = url.searchParams.get('month');
    if (!month) fail('Trebuie specificat date sau month.');
    if (!monthOK(month)) fail('Lună invalidă.');
    const childId = url.searchParams.get('childId');
    const groupId = url.searchParams.get('groupId');
    const childIds = childId ? [childId] : groupId ? childIdsForGroup(groupId) : null;
    return { entries: repository.listByMonth(month, childIds) };
  }

  /** @param {unknown} change @param {string} todayStr */
  function assertValidChange(change, todayStr) {
    const candidate = /** @type {{ childId?: unknown, date?: unknown, status?: unknown, reason?: unknown }} */ (change);
    if (!candidate || typeof candidate.childId !== 'string') fail('Copil invalid.');
    if (!recordRepository.exists('children', /** @type {string} */ (candidate.childId)))
      fail(`Copil inexistent: ${candidate.childId}.`);
    if (typeof candidate.date !== 'string' || !dateOK(candidate.date)) fail('Zi invalidă.');
    if (candidate.date > todayStr) fail(FUTURE_DATE_MESSAGE);
    if (candidate.status !== null && !ATTENDANCE_STATUSES.includes(/** @type {any} */ (candidate.status)))
      fail('Stare invalidă.');
    if (candidate.reason !== undefined && typeof candidate.reason !== 'string') fail('Motiv invalid.');
  }

  /** @param {{ body: { changes?: unknown } }} request */
  function handlePost({ body }) {
    const changes = /** @type {any[]} */ (body?.changes);
    if (!Array.isArray(changes) || changes.length === 0) fail('Lista de schimbări este goală.');
    if (changes.length > MAX_CHANGES_PER_REQUEST) fail('Prea multe schimbări într-o singură cerere.');
    const todayStr = today();
    for (const change of changes) assertValidChange(change, todayStr);
    const normalized = changes.map(normalizeAttendanceChange);
    const { saved, removed } = repository.applyChanges(normalized);
    return { ok: true, saved, removed };
  }

  return [
    { method: 'GET', path: '/api/attendance', handle: handleGet },
    { method: 'POST', path: '/api/attendance', handle: handlePost },
  ];
}
