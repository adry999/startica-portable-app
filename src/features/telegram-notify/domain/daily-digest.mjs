import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatDate, formatMonthName, formatLongDate } from '#shared/format/date-format.mjs';
import { shiftDays, daysBetween } from '#shared/domain/calendar-month.mjs';

/** @typedef {import('../telegram-notify.types.mjs').DigestInputs} DigestInputs */
/** @typedef {import('../telegram-notify.types.mjs').DailyDigest} DailyDigest */

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

function buildBirthdaysSection(birthdays, todayStr) {
  if (!birthdays.length) return null;
  const lines = birthdays.map(
    ({ child, daysUntil, turningAge }) =>
      `• ${birthdayLabel(daysUntil, todayStr)}: ${escapeHtml(child.name)} (${ageText(turningAge)})`,
  );
  return ['<b>Zile de naștere</b>', ...lines].join('\n');
}

function visitLine(visit) {
  const parts = [visit.time, escapeHtml(visit.name)];
  if (visit.phone) parts.push(escapeHtml(visit.phone));
  if (visit.parent) parts.push(escapeHtml(visit.parent));
  return `• ${parts.join(' · ')}`;
}

// „Vizite azi” și „Vizite mâine” sunt sub-secțiuni ale aceluiași bloc (fără
// linie goală între ele); fiecare apare doar când are vizite.
function buildVisitsSection(visits, todayStr) {
  const tomorrowStr = shiftDays(todayStr, 1);
  const todayVisits = visits.filter(visit => visit.date === todayStr);
  const tomorrowVisits = visits.filter(visit => visit.date === tomorrowStr);
  const blocks = [];
  if (todayVisits.length) blocks.push(['<b>Vizite azi</b>', ...todayVisits.map(visitLine)].join('\n'));
  if (tomorrowVisits.length) blocks.push(['<b>Vizite mâine</b>', ...tomorrowVisits.map(visitLine)].join('\n'));
  return blocks.length ? blocks.join('\n') : null;
}

// Un copil apare cu detalii luni (cadența săptămânală) sau în ziua în care
// intră prima dată în „De notificat” pe luna curentă (fără cheia lui în registru).
function buildOverdueSection(overdue, todayStr, sentKeys) {
  if (!overdue.length) return { section: null, detailedChildIds: [], month: todayStr.slice(0, 7) };
  const month = todayStr.slice(0, 7);
  const isMonday = new Date(`${todayStr}T12:00:00`).getDay() === 1;
  const detailedChildIds = [];
  const lines = [];
  let total = 0;
  for (const { child, obligation } of overdue) {
    total += obligation.rest ?? 0;
    const alreadySent = Object.hasOwn(sentKeys, `plata:${child.id}:${month}`);
    if (isMonday || !alreadySent) {
      detailedChildIds.push(child.id);
      lines.push(
        `• ${escapeHtml(child.name)} · rest ${formatMoney(obligation.rest)} · scadent ${formatDate(obligation.due)}`,
      );
    }
  }
  const count = overdue.length;
  let totalLine = `${count} ${count === 1 ? 'copil' : 'copii'} cu rest de plată (${formatMoney(total)} în total).`;
  if (!detailedChildIds.length) totalLine += ' Lista completă vine luni; între timp, Startica › De notificat.';
  const header = `<b>De notificat · ${escapeHtml(formatMonthName(month))}</b>`;
  return { section: [header, ...lines, totalLine].join('\n'), detailedChildIds, month };
}

/**
 * @param {DigestInputs} inputs
 * @returns {DailyDigest}
 */
export function buildDailyDigest({ todayStr, birthdays, visits, overdue, sentKeys }) {
  const sections = [];
  const birthdaysSection = buildBirthdaysSection(birthdays, todayStr);
  if (birthdaysSection) sections.push(birthdaysSection);
  const visitsSection = buildVisitsSection(visits, todayStr);
  if (visitsSection) sections.push(visitsSection);
  const { section: overdueSection, detailedChildIds, month } = buildOverdueSection(overdue, todayStr, sentKeys);
  if (overdueSection) sections.push(overdueSection);

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
