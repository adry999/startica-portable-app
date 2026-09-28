import { fail } from '#core/server/errors/domain-error.mjs';
import { monthOK, today as localToday } from '#shared/domain/calendar-month.mjs';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { parsePoolSettings, POOL_SETTINGS_KEY } from '../domain/pool-settings.mjs';
import { childMonth, coachPayForMonth, countUnmarkedPastSessions } from '../domain/pool-month.mjs';

/**
 * „Închide luna” (22c): scrie taxa fiecărui copil și plata fiecărui antrenor — id-uri deterministe
 * per (childId|coachId, month), deci o reînchidere recalculează și suprascrie, nu dublează
 * (decizia 5). Refuză cât timp o ședință trecută a rămas nemarcată — banii nu se calculează
 * niciodată dintr-o ședință neconsemnată.
 * @param {{
 *   poolRepository: import('./pool.repository.mjs').PoolRepository,
 *   recordRepository: import('#shared/contracts/persistence.mjs').RecordRepository,
 *   runRevisionTransaction: import('#shared/contracts/persistence.mjs').RunRevisionTransaction,
 *   auditTrail: import('#shared/contracts/audit-trail.mjs').AuditTrail,
 *   readSetting: (key: string) => string,
 *   listCoaches: () => { id: string }[],
 *   payCoach: (input: { staffId: string, month: string, gross: number, date: string, method: string }) => { paid: boolean },
 *   today?: () => string,
 * }} dependencies
 */
export function createPoolClosingService({
  poolRepository,
  recordRepository,
  runRevisionTransaction,
  auditTrail,
  readSetting,
  listCoaches,
  payCoach,
  today = localToday,
}) {
  function readSettings() {
    return parsePoolSettings(readSetting(POOL_SETTINGS_KEY));
  }

  /** @param {{ month: string, method: string, date: string, revision: number, requestId: string }} input */
  function closeMonth({ month, method, date, revision, requestId }) {
    if (!monthOK(month)) fail('Lună invalidă.');
    const settings = readSettings();
    if (!settings || !settings.enabled) fail('Bazinul nu este configurat pentru această filială.');
    const todayStr = today();
    // Toate programările (inclusiv arhivate) — o programare oprită luna trecută a avut totuși
    // ședințe luna asta, care tot trebuie taxate/plătite la închidere.
    const bookings = poolRepository.listBookings({ includeArchived: true });
    const sessions = poolRepository.sessionsForMonth(month);
    const unmarked = countUnmarkedPastSessions({ bookings, sessions, month, todayStr });
    if (unmarked > 0)
      fail(
        `${unmarked} ${unmarked === 1 ? 'ședință nemarcată' : 'ședințe nemarcate'} — consemnează-le înainte de închidere.`,
      );

    const childIds = [...new Set(bookings.map(booking => booking.childId))];
    const chargesByChildId = new Map();
    for (const childId of childIds) {
      const row = childMonth({
        bookings: bookings.filter(booking => booking.childId === childId),
        sessions,
        month,
        settings,
        todayStr,
      });
      if (row.amount <= 0) continue;
      const taxable = row.present + (settings.chargeUnexcusedAbsence ? row.absent : 0);
      chargesByChildId.set(childId, {
        id: `CHG-bazin-${childId}-${month}`,
        childId,
        month,
        kind: 'bazin',
        label: `Bazin ${month}: ${taxable} × ${settings.pricePerSession} lei`,
        amount: row.amount,
        currency: 'MDL',
        date,
      });
    }

    const coachPays = listCoaches()
      .map(coach => ({
        coachId: coach.id,
        pay: coachPayForMonth({ coachId: coach.id, bookings, sessions, month, settings, todayStr }),
      }))
      .filter(({ pay }) => pay.amount > 0);

    let paidCoaches = 0;
    const envelope = runRevisionTransaction(
      { revision, requestId },
      { action: 'închidere lună bazin', backupBefore: false },
      () => {
        for (const childId of childIds) {
          const chargeId = `CHG-bazin-${childId}-${month}`;
          const existing = recordRepository.find('charges', chargeId);
          const next = chargesByChildId.get(childId);
          if (next) {
            const normalized = normalizeRecord('charges', next);
            // JSON neschimbat = fără scriere, deci fără intrare nouă în outbox/istoric la o
            // reînchidere care nu modifică nimic (decizia 5).
            if (JSON.stringify(existing) === JSON.stringify(normalized)) continue;
            recordRepository.save('charges', normalized);
            auditTrail.recordChange({
              action: existing ? 'modificare' : 'adăugare',
              recordType: 'charges',
              recordId: chargeId,
              before: existing,
              after: normalized,
            });
          } else if (existing) {
            recordRepository.remove('charges', chargeId);
            auditTrail.recordChange({
              action: 'ștergere',
              recordType: 'charges',
              recordId: chargeId,
              before: existing,
              after: null,
            });
          }
        }
        for (const { coachId, pay } of coachPays) {
          const result = payCoach({ staffId: coachId, month, gross: pay.amount, date, method });
          if (result.paid) paidCoaches++;
        }
        poolRepository.saveClosing(month, new Date().toISOString());
      },
    );
    return { ...envelope, charges: chargesByChildId.size, coaches: paidCoaches };
  }

  return { closeMonth };
}
