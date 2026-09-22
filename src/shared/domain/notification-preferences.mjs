// Preferințele de notificare: ce trimite rezumatul zilnic Telegram și ce arată
// memento-urile Windows. Un singur obiect, cu valori implicite egale cu
// comportamentul dinainte de acest modul, ca o bază existentă fără rând
// `notificationPreferences` în `settings` să lucreze neschimbat.

/** @typedef {'daily' | 'monday' | 'never'} OverdueCadence */

/**
 * @typedef {{
 *   birthdaysEnabled: boolean,
 *   birthdaysDaysBefore: number,
 *   visitsEnabled: boolean,
 *   visitsHorizonDays: number,
 *   overdueEnabled: boolean,
 *   overdueCadence: OverdueCadence,
 *   nothingToReportEnabled: boolean,
 *   digestTime: string,
 *   windowsVisitsTodayEnabled: boolean,
 *   windowsVisitSoonEnabled: boolean,
 *   windowsVisitSoonMinutes: number,
 * }} NotificationPreferences
 */

/** @type {NotificationPreferences} */
export const DEFAULT_NOTIFICATION_PREFERENCES = {
  birthdaysEnabled: true,
  birthdaysDaysBefore: 2,
  visitsEnabled: true,
  visitsHorizonDays: 1,
  overdueEnabled: true,
  overdueCadence: 'monday',
  nothingToReportEnabled: true,
  digestTime: '08:00',
  windowsVisitsTodayEnabled: true,
  windowsVisitSoonEnabled: true,
  windowsVisitSoonMinutes: 30,
};

const OVERDUE_CADENCES = ['daily', 'monday', 'never'];
const DIGEST_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const clampInt = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const asBoolean = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

/**
 * Completează și validează un obiect parțial (din formular sau dintr-un JSON
 * stocat, eventual corupt) cu valorile implicite pentru orice câmp lipsă sau
 * nevalid. Nu aruncă niciodată: un rând stricat în `settings` nu trebuie să
 * oprească rezumatul, doar să revină la comportamentul implicit pe acel câmp.
 * @param {Partial<NotificationPreferences> | null | undefined} overrides
 * @returns {NotificationPreferences}
 */
export function clampNotificationPreferences(overrides) {
  const o = overrides && typeof overrides === 'object' ? overrides : {};
  const d = DEFAULT_NOTIFICATION_PREFERENCES;
  return {
    birthdaysEnabled: asBoolean(o.birthdaysEnabled, d.birthdaysEnabled),
    birthdaysDaysBefore: clampInt(o.birthdaysDaysBefore, 0, 14, d.birthdaysDaysBefore),
    visitsEnabled: asBoolean(o.visitsEnabled, d.visitsEnabled),
    visitsHorizonDays: clampInt(o.visitsHorizonDays, 0, 14, d.visitsHorizonDays),
    overdueEnabled: asBoolean(o.overdueEnabled, d.overdueEnabled),
    overdueCadence:
      typeof o.overdueCadence === 'string' && OVERDUE_CADENCES.includes(o.overdueCadence)
        ? /** @type {OverdueCadence} */ (o.overdueCadence)
        : d.overdueCadence,
    nothingToReportEnabled: asBoolean(o.nothingToReportEnabled, d.nothingToReportEnabled),
    digestTime:
      typeof o.digestTime === 'string' && DIGEST_TIME_PATTERN.test(o.digestTime) ? o.digestTime : d.digestTime,
    windowsVisitsTodayEnabled: asBoolean(o.windowsVisitsTodayEnabled, d.windowsVisitsTodayEnabled),
    windowsVisitSoonEnabled: asBoolean(o.windowsVisitSoonEnabled, d.windowsVisitSoonEnabled),
    windowsVisitSoonMinutes: clampInt(o.windowsVisitSoonMinutes, 5, 120, d.windowsVisitSoonMinutes),
  };
}

/**
 * @param {string | undefined | null} json
 * @returns {NotificationPreferences}
 */
export function parseNotificationPreferences(json) {
  if (!json) return clampNotificationPreferences(null);
  try {
    return clampNotificationPreferences(JSON.parse(json));
  } catch {
    return clampNotificationPreferences(null);
  }
}

// Rulare ratată reluată seara (B1 din auditul 2026-09-18): tăierea era fixă la
// 18:00, adică ora rezumatului + 10h cât timp aceasta era fixă la 08:00.
// Cu ora configurabilă, tăierea rămâne relativă la ea, nu un ceas fix.
const LATE_RUN_GRACE_HOURS = 10;

/**
 * Momentul (azi, ora rezumatului + 10h) după care o rulare ratată nu mai trimite
 * rezumatul de azi. Fără plafon la 23: pentru o oră de rezumat târzie (ex. 20:00),
 * `setHours` trece firesc peste miezul nopții — audit 2026-09-22 (plafonul vechi la
 * ora 23 prăbușea grația la 0h pentru un rezumat setat la 23:00).
 * @param {Date} now
 * @param {string} digestTime `HH:mm`
 * @returns {boolean}
 */
export function isDigestRunTooLate(now, digestTime) {
  const match = DIGEST_TIME_PATTERN.test(digestTime) ? digestTime : DEFAULT_NOTIFICATION_PREFERENCES.digestTime;
  const [hour, minute] = match.split(':').map(Number);
  const cutoff = new Date(now);
  cutoff.setHours(hour, minute, 0, 0);
  cutoff.setHours(cutoff.getHours() + LATE_RUN_GRACE_HOURS);
  return now >= cutoff;
}
