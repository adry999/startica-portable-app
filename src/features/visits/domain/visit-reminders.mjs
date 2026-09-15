/** @typedef {import('./visit-status.mjs').Visit} Visit */
/** @typedef {{ key: string, title: string, body: string }} VisitReminder */

const REMINDER_WINDOW_MINUTES = 30;

const isoDate = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const pluralVisits = count => (count === 1 ? '1 vizită' : `${count} vizite`);

// `now` e ceasul local al operatorului; `date`/`time` pe vizită sunt tot ora locală introdusă în formular, deci comparația directă e corectă fără fus orar.
/**
 * @param {Visit[]} visits
 * @param {Date} now
 * @param {string[]} notifiedKeys
 * @returns {VisitReminder[]}
 */
export function selectDueReminders(visits, now, notifiedKeys) {
  const notified = new Set(notifiedKeys);
  const todayStr = isoDate(now);
  const scheduled = visits
    .filter(visit => !visit.archived && visit.status === 'Programată')
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const reminders = [];

  const todaysVisits = scheduled.filter(visit => visit.date === todayStr);
  const dayKey = `zi:${todayStr}`;
  if (todaysVisits.length > 0 && !notified.has(dayKey)) {
    reminders.push({
      key: dayKey,
      title: 'Vizite azi',
      body: `${pluralVisits(todaysVisits.length)}: ${todaysVisits.map(visit => `${visit.time} ${visit.name}`).join(', ')}`,
    });
  }

  for (const visit of scheduled) {
    const key = `vizita:${visit.id}:${visit.date}:${visit.time}`;
    if (notified.has(key)) continue;
    const scheduledAt = new Date(`${visit.date}T${visit.time}:00`);
    const minutesLeft = (scheduledAt.getTime() - now.getTime()) / 60000;
    if (minutesLeft <= 0 || minutesLeft > REMINDER_WINDOW_MINUTES) continue;
    reminders.push({
      key,
      title: `Vizită peste ${Math.round(minutesLeft)} min`,
      body: `${visit.time} · ${visit.name} · ${visit.phone}`,
    });
  }

  return reminders;
}
