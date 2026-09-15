import { daysBetween } from '#shared/domain/calendar-month.mjs';

/** @typedef {{ id: string, healthNotes: string, statusChangedAt: string }} VisitHealthNotes */
/** @typedef {{ id: string, healthNotes: string, archived: boolean, archivedAt: string }} ArchivableChild */
/** @typedef {{ visits: VisitHealthNotes[], children: ArchivableChild[] }} HealthNotesSnapshot */
/**
 * Id-urile înregistrărilor a căror `healthNotes` trebuie golită.
 * @typedef {{ visits: string[], children: string[] }} ExpiredHealthNotes
 */

const RETENTION_DAYS = 365;

/**
 * @param {HealthNotesSnapshot} snapshot
 * @param {string} todayStr
 * @returns {ExpiredHealthNotes}
 */
export function selectExpiredHealthNotes(snapshot, todayStr) {
  const visits = snapshot.visits
    .filter(visit => visit.healthNotes && daysBetween(visit.statusChangedAt.slice(0, 10), todayStr) >= RETENTION_DAYS)
    .map(visit => visit.id);
  const children = snapshot.children
    .filter(
      child =>
        child.healthNotes && child.archived && daysBetween(child.archivedAt.slice(0, 10), todayStr) >= RETENTION_DAYS,
    )
    .map(child => child.id);
  return { visits, children };
}
