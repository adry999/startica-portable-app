// Setările bazinului (22d) — o cheie per filială, ca planPresets (decizia 10,
// 2026-09-27-personal-bazin.md): cât timp cheia lipsește, ecranul arată formularul cu semințele
// ca prefill, dar nu calculează nimic — valorile implicite „se țin în setări, nu în cod".
export const POOL_SETTINGS_KEY = 'poolSettings';
export const COACH_PAY_MODES = ['per_child', 'per_session'];
const TIME_OK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** @type {import('../pool.types.d.mts').PoolSettings} */
export const POOL_SETTINGS_SEED = {
  enabled: false,
  pricePerSession: 150,
  durationMin: 30,
  hoursFrom: '09:00',
  hoursTo: '11:30',
  seatsPerSlot: null,
  chargeUnexcusedAbsence: true,
  coachPayMode: 'per_child',
  coachRate: 60,
};

/** @param {unknown} input @returns {boolean} */
export function validatePoolSettings(input) {
  const settings = /** @type {any} */ (input);
  return (
    !!settings &&
    typeof settings === 'object' &&
    typeof settings.enabled === 'boolean' &&
    Number.isFinite(settings.pricePerSession) &&
    settings.pricePerSession > 0 &&
    settings.pricePerSession <= 100000 &&
    Number.isInteger(settings.durationMin) &&
    settings.durationMin > 0 &&
    settings.durationMin <= 240 &&
    typeof settings.hoursFrom === 'string' &&
    TIME_OK.test(settings.hoursFrom) &&
    typeof settings.hoursTo === 'string' &&
    TIME_OK.test(settings.hoursTo) &&
    settings.hoursFrom < settings.hoursTo &&
    (settings.seatsPerSlot === null || (Number.isInteger(settings.seatsPerSlot) && settings.seatsPerSlot > 0)) &&
    typeof settings.chargeUnexcusedAbsence === 'boolean' &&
    COACH_PAY_MODES.includes(settings.coachPayMode) &&
    Number.isFinite(settings.coachRate) &&
    settings.coachRate > 0 &&
    settings.coachRate <= 100000
  );
}

/** @param {any} settings @returns {import('../pool.types.d.mts').PoolSettings} */
export function normalizePoolSettings(settings) {
  return {
    enabled: !!settings.enabled,
    pricePerSession: settings.pricePerSession,
    durationMin: settings.durationMin,
    hoursFrom: settings.hoursFrom,
    hoursTo: settings.hoursTo,
    seatsPerSlot: settings.seatsPerSlot ?? null,
    chargeUnexcusedAbsence: !!settings.chargeUnexcusedAbsence,
    coachPayMode: settings.coachPayMode,
    coachRate: settings.coachRate,
  };
}

/**
 * @param {string} json
 * @returns {import('../pool.types.d.mts').PoolSettings | null}
 */
export function parsePoolSettings(json) {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return validatePoolSettings(parsed) ? normalizePoolSettings(parsed) : null;
  } catch {
    return null;
  }
}

/**
 * Sloturile orare ale zilei, din durationMin în durationMin, între hoursFrom și hoursTo.
 * @param {import('../pool.types.d.mts').PoolSettings} settings
 * @returns {string[]}
 */
export function slotTimes(settings) {
  const times = [];
  let [hour, minute] = settings.hoursFrom.split(':').map(Number);
  const [endHour, endMinute] = settings.hoursTo.split(':').map(Number);
  while (hour < endHour || (hour === endHour && minute < endMinute)) {
    times.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    minute += settings.durationMin;
    while (minute >= 60) {
      minute -= 60;
      hour += 1;
    }
  }
  return times;
}
