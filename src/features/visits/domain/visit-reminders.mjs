import { isoDateOf } from '#shared/domain/calendar-month.mjs';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '#shared/domain/notification-preferences.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Visit} Visit */
/** @typedef {{ key: string, title: string, body: string }} VisitReminder */
/** @typedef {import('#shared/domain/notification-preferences.mjs').NotificationPreferences} NotificationPreferences */

const pluralVisits = count => (count === 1 ? '1 vizită' : `${count} vizite`);

// `now` e ceasul local al operatorului; `date`/`time` pe vizită sunt tot ora locală introdusă în formular, deci comparația directă e corectă fără fus orar.
/**
 * @param {Visit[]} visits
 * @param {Date} now
 * @param {string[]} notifiedKeys
 * @param {Pick<NotificationPreferences, 'windowsVisitsTodayEnabled' | 'windowsVisitSoonEnabled' | 'windowsVisitSoonMinutes'>} [preferences]
 * @returns {VisitReminder[]}
 */
export function selectDueReminders(visits, now, notifiedKeys, preferences = DEFAULT_NOTIFICATION_PREFERENCES) {
  const { windowsVisitsTodayEnabled, windowsVisitSoonEnabled, windowsVisitSoonMinutes } = preferences;
  const notified = new Set(notifiedKeys);
  const todayStr = isoDateOf(now);
  const scheduled = visits
    .filter(visit => !visit.archived && visit.status === 'Programată')
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const reminders = [];

  if (windowsVisitsTodayEnabled) {
    const todaysVisits = scheduled.filter(visit => visit.date === todayStr);
    const dayKey = `zi:${todayStr}`;
    if (todaysVisits.length > 0 && !notified.has(dayKey)) {
      reminders.push({
        key: dayKey,
        title: 'Vizite azi',
        body: `${pluralVisits(todaysVisits.length)}: ${todaysVisits.map(visit => `${visit.time} ${visit.name}`).join(', ')}`,
      });
    }
  }

  if (windowsVisitSoonEnabled) {
    for (const visit of scheduled) {
      const key = `vizita:${visit.id}:${visit.date}:${visit.time}`;
      if (notified.has(key)) continue;
      const scheduledAt = new Date(`${visit.date}T${visit.time}:00`);
      const minutesLeft = (scheduledAt.getTime() - now.getTime()) / 60000;
      if (minutesLeft <= 0 || minutesLeft > windowsVisitSoonMinutes) continue;
      reminders.push({
        key,
        title: `Vizită peste ${Math.round(minutesLeft)} min`,
        body: `${visit.time} · ${visit.name} · ${visit.phone}`,
      });
    }
  }

  return reminders;
}
