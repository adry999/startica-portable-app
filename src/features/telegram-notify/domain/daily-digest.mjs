import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatDate, formatMonthName, formatLongDate } from '#shared/format/date-format.mjs';
import { shiftDays, daysBetween } from '#shared/domain/calendar-month.mjs';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '#shared/domain/notification-preferences.mjs';

/** @typedef {import('../telegram-notify.types.mjs').DigestInputs} DigestInputs */
/** @typedef {import('../telegram-notify.types.mjs').DailyDigest} DailyDigest */
/** @typedef {import('#shared/domain/notification-preferences.mjs').NotificationPreferences} NotificationPreferences */

const MAX_CHUNK_LENGTH = 4096;
const SENT_KEY_RETENTION_DAYS = 60;
const NOTHING_TO_REPORT =
  'Nimic de semnalat azi: nicio zi de naștere în următoarele 3 zile, nicio vizită azi sau mâine, niciun copil de notificat.';

const dayMonth = dateStr => {
  const [, month, day] = dateStr.split('-');
  return `${day}.${month}`;
};

function birthdayLabel(daysUntil, todayStr) {
  if (daysUntil === 0) return 'Azi';
  if (daysUntil === 1) return 'Mâine';
  return `Poimâine, ${dayMonth(shiftDays(todayStr, daysUntil))}`;
}

const ageText = turningAge => (turningAge === 1 ? 'împlinește 1 an' : `împlinește ${turningAge} ani`);

function buildBirthdaysSection(birthdays, todayStr, enabled) {
  if (!enabled || !birthdays.length) return null;
  const lines = birthdays.map(
    ({ child, daysUntil, turningAge }) =>
      `• ${birthdayLabel(daysUntil, todayStr)}: ${escapeHtml(child.name)} (${ageText(turningAge)})`,
  );
  return ['<b>Zile de naștere</b>', ...lines].join('\n');
}

function visitLine(visit, { withDate = false } = {}) {
  const segments = [withDate ? `${dayMonth(visit.date)} ${visit.time}` : visit.time, escapeHtml(visit.name)];
  if (visit.phone) segments.push(escapeHtml(visit.phone));
  if (visit.parent) segments.push(escapeHtml(visit.parent));
  return `• ${segments.join(' · ')}`;
}

// „Vizite azi”, „Vizite mâine” și „Vizite în zilele următoare” sunt sub-secțiuni ale
// aceluiași bloc (fără linie goală între ele); fiecare apare doar când are vizite.
// A treia există doar când orizontul din preferințe trece de mâine (§ preferințe).
function buildVisitsSection(visits, todayStr, enabled) {
  if (!enabled || !visits.length) return null;
  const tomorrowStr = shiftDays(todayStr, 1);
  const todayVisits = visits.filter(visit => visit.date === todayStr);
  const tomorrowVisits = visits.filter(visit => visit.date === tomorrowStr);
  const laterVisits = visits
    .filter(visit => visit.date > tomorrowStr)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const blocks = [];
  if (todayVisits.length) blocks.push(['<b>Vizite azi</b>', ...todayVisits.map(v => visitLine(v))].join('\n'));
  if (tomorrowVisits.length) blocks.push(['<b>Vizite mâine</b>', ...tomorrowVisits.map(v => visitLine(v))].join('\n'));
  if (laterVisits.length)
    blocks.push(
      ['<b>Vizite în zilele următoare</b>', ...laterVisits.map(v => visitLine(v, { withDate: true }))].join('\n'),
    );
  return blocks.length ? blocks.join('\n') : null;
}

// Un copil apare cu detalii după cadența aleasă: zilnic (mereu), luni (cadența
// săptămânală implicită) sau niciodată (doar totalul). „monday” e comportamentul
// dinainte de preferințe: luni, sau în ziua în care intră prima dată în listă.
function buildOverdueSection(overdue, todayStr, sentKeys, enabled, cadence) {
  if (!enabled || !overdue.length) return { section: null, detailedChildIds: [], month: todayStr.slice(0, 7) };
  const month = todayStr.slice(0, 7);
  const isMonday = new Date(`${todayStr}T12:00:00`).getDay() === 1;
  const detailedChildIds = [];
  const lines = [];
  let total = 0;
  for (const { child, obligation } of overdue) {
    total += obligation.rest ?? 0;
    const alreadySent = Object.hasOwn(sentKeys, `plata:${child.id}:${month}`);
    const detailed = cadence === 'daily' || (cadence === 'monday' && (isMonday || !alreadySent));
    if (detailed) {
      detailedChildIds.push(child.id);
      lines.push(
        `• ${escapeHtml(child.name)} · rest ${formatMoney(obligation.rest)} · scadent ${formatDate(obligation.due)}`,
      );
    }
  }
  const count = overdue.length;
  let totalLine = `${count} ${count === 1 ? 'copil' : 'copii'} cu rest de plată (${formatMoney(total)} în total).`;
  if (!detailedChildIds.length) {
    totalLine +=
      cadence === 'never'
        ? ' Detaliile sunt în Startica › De notificat.'
        : ' Lista completă vine luni; între timp, Startica › De notificat.';
  }
  const header = `<b>De notificat · ${escapeHtml(formatMonthName(month))}</b>`;
  return { section: [header, ...lines, totalLine].join('\n'), detailedChildIds, month };
}

/**
 * @param {DigestInputs & { preferences?: Pick<NotificationPreferences,
 *   'birthdaysEnabled' | 'visitsEnabled' | 'overdueEnabled' | 'overdueCadence' | 'nothingToReportEnabled'> }} inputs
 * @returns {DailyDigest}
 */
export function buildDailyDigest({
  todayStr,
  birthdays,
  visits,
  overdue,
  sentKeys,
  preferences = DEFAULT_NOTIFICATION_PREFERENCES,
}) {
  const { birthdaysEnabled, visitsEnabled, overdueEnabled, overdueCadence, nothingToReportEnabled } = preferences;
  const sections = [];
  const birthdaysSection = buildBirthdaysSection(birthdays, todayStr, birthdaysEnabled);
  if (birthdaysSection) sections.push(birthdaysSection);
  const visitsSection = buildVisitsSection(visits, todayStr, visitsEnabled);
  if (visitsSection) sections.push(visitsSection);
  const {
    section: overdueSection,
    detailedChildIds,
    month,
  } = buildOverdueSection(overdue, todayStr, sentKeys, overdueEnabled, overdueCadence);
  if (overdueSection) sections.push(overdueSection);

  if (!sections.length && !nothingToReportEnabled) return { text: '', keys: [] };

  const title = `<b>Startica · ${formatLongDate(todayStr)}</b>`;
  const body = sections.length ? sections.join('\n\n') : NOTHING_TO_REPORT;

  return {
    text: `${title}\n\n${body}`,
    keys: [`zi:${todayStr}`, ...detailedChildIds.map(childId => `plata:${childId}:${month}`)],
  };
}

/**
 * @param {string} text
 * @param {number} [maxLength]
 * @returns {string[]}
 */
export function splitDigest(text, maxLength = MAX_CHUNK_LENGTH) {
  if (text.length <= maxLength) return [text];
  const chunks = [];
  let current = '';
  for (const line of text.split('\n')) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > maxLength && current) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * @param {Record<string, string>} sentKeys
 * @param {string} todayStr
 * @returns {Record<string, string>}
 */
export function pruneSentKeys(sentKeys, todayStr) {
  /** @type {Record<string, string>} */
  const kept = {};
  for (const [key, sentAt] of Object.entries(sentKeys)) {
    if (daysBetween(sentAt, todayStr) < SENT_KEY_RETENTION_DAYS) kept[key] = sentAt;
  }
  return kept;
}
