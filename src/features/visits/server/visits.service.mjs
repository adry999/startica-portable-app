import { randomUUID } from 'node:crypto';
import { fail } from '#core/server/errors/domain-error.mjs';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { assertRecordReferencesExist } from '#shared/domain/record-integrity.mjs';
import { today } from '#shared/domain/calendar-month.mjs';
import { selectExpiredHealthNotes } from '../domain/visit-health-notes.mjs';

/** @typedef {import('../visits.types.mjs').VisitsServiceDependencies} VisitsServiceDependencies */

const ENROL_ACTION = 'inscriere-vizita';
const EXPIRE_ACTION = 'expirare-date-medicale';
const EXPIRE_AUDIT_ACTION = 'expirare date medicale';

/** @param {VisitsServiceDependencies} dependencies */
export function createVisitsService({ recordRepository, auditTrail, runRevisionTransaction }) {
  /**
   * O singură tranzacție: fișa copilului și vizita marcată „Înscris” apar împreună, fără stări intermediare.
   * @param {{ visitId: string, child: unknown }} input
   * @param {import('#shared/contracts/persistence.mjs').RevisionRequest} request
   */
  function enrolChild({ visitId, child }, request) {
    const envelope = runRevisionTransaction(request, { action: ENROL_ACTION, backupBefore: false }, () => {
      const visit = recordRepository.find('visits', visitId);
      if (!visit) fail('Vizita nu mai există.', 409);
      if (visit.status === 'Înscris') fail('Copilul a fost deja înscris din această vizită.', 409);
      if (visit.archived) fail('Reactivează vizita înainte de înscriere.');
      // Regulă confirmată explicit: nu se înscrie un copil a cărui vizită nu a avut loc încă
      // (fără ocolire de la Programată/Neprezentată/Renunțat, doar de la Efectuată).
      if (visit.status !== 'Efectuată') fail('Vizita trebuie marcată Efectuată înainte de a înscrie copilul.');

      const record = normalizeRecord('children', child);
      if (recordRepository.exists('children', record.id)) fail('ID deja folosit.', 409);
      assertRecordReferencesExist('children', record, recordRepository.exists);
      recordRepository.save('children', record);
      auditTrail.recordChange({
        action: 'adăugare',
        recordType: 'children',
        recordId: record.id,
        before: null,
        after: record,
      });

      const now = new Date().toISOString();
      const updated = normalizeRecord('visits', {
        ...visit,
        status: 'Înscris',
        childId: record.id,
        healthNotes: '',
        statusChangedAt: now,
        history: [...visit.history, { at: now, status: 'Înscris', date: visit.date, time: visit.time }],
      });
      recordRepository.save('visits', updated);
      auditTrail.recordChange({
        action: 'modificare',
        recordType: 'visits',
        recordId: updated.id,
        before: visit,
        after: updated,
      });
    });

    // Citit după tranzacție, nu dintr-o variabilă capturată: la o reluare (același requestId),
    // applyChanges nu rulează a doua oară, dar vizita din bază are deja childId-ul înscrierii inițiale.
    const enrolledVisit = recordRepository.find('visits', visitId);
    if (!enrolledVisit) fail('Vizita nu mai există.', 409);
    return { ...envelope, childId: enrolledVisit.childId };
  }

  /**
   * Cererea sintetică e legitimă: tranzacția cere doar `requestId` și `revision`,
   * iar la pornire nu există altă filă care să o fi schimbat între citire și scriere.
   * @param {string} [todayStr]
   */
  function expireHealthNotes(todayStr = today()) {
    const snapshot = recordRepository.readSnapshot();
    const expired = selectExpiredHealthNotes(snapshot, todayStr);
    const expiredCount = expired.visits.length + expired.children.length;
    if (expiredCount === 0) return { expired: 0 };

    const request = { requestId: randomUUID(), revision: recordRepository.currentRevision() };
    const envelope = runRevisionTransaction(request, { action: EXPIRE_ACTION }, () => {
      for (const id of expired.visits) {
        const visit = recordRepository.find('visits', id);
        if (!visit) continue;
        const updated = { ...visit, healthNotes: '' };
        recordRepository.save('visits', updated);
        auditTrail.recordChange({
          action: EXPIRE_AUDIT_ACTION,
          recordType: 'visits',
          recordId: id,
          before: visit,
          after: updated,
        });
      }
      for (const id of expired.children) {
        const child = recordRepository.find('children', id);
        if (!child) continue;
        const updated = { ...child, healthNotes: '' };
        recordRepository.save('children', updated);
        auditTrail.recordChange({
          action: EXPIRE_AUDIT_ACTION,
          recordType: 'children',
          recordId: id,
          before: child,
          after: updated,
        });
      }
    });

    return { expired: expiredCount, ...envelope };
  }

  return { enrolChild, expireHealthNotes };
}
