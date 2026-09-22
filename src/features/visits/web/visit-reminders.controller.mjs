import { DomainEvent } from '#shared/contracts/domain-events.mjs';
import { shiftDays, isoDateOf } from '#shared/domain/calendar-month.mjs';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '#shared/domain/notification-preferences.mjs';
import { selectDueReminders } from '../domain/visit-reminders.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {'default' | 'granted' | 'denied' | 'unsupported'} NotificationPermission */

const POLL_INTERVAL_MS = 60000;
const BLOCKED_HINT = 'Notificările sunt blocate în browser; vizitele apar în Panou.';

/** Cheia „zi:<dată>” și „vizita:<id>:<dată>:<oră>” rămân utile doar cât vizează azi sau mâine;
 * orice altă cheie e din zile trecute și s-ar aduna la nesfârșit dacă nu ar fi ștearsă. */
function extractKeyDate(key) {
  if (key.startsWith('zi:')) return key.slice(3);
  const match = key.match(/^vizita:[^:]+:(\d{4}-\d{2}-\d{2}):/);
  return match ? match[1] : null;
}

/**
 * @param {string[]} keys
 * @param {string} todayStr
 * @param {string} tomorrowStr
 */
function keepCurrentKeys(keys, todayStr, tomorrowStr) {
  return keys.filter(key => {
    const date = extractKeyDate(key);
    return date === todayStr || date === tomorrowStr;
  });
}

/**
 * Memento-urile Windows pentru vizitele din calendar: la fiecare minut și la reîncărcarea
 * datelor, trimite o notificare pentru fiecare memento nou (dedus de `selectDueReminders`,
 * domeniu pur) și cere/urmărește permisiunea din butonul ecranului „Vizite”.
 * @param {{
 *   readRecords: () => RecordsSnapshot,
 *   readNow: () => Date,
 *   notifications: {
 *     permission: () => NotificationPermission,
 *     request: () => Promise<string>,
 *     show: (title: string, body: string, key: string, onClick?: () => void) => void,
 *   },
 *   rememberedKeys: { read: () => string[], write: (keys: string[]) => void },
 *   eventBus: { subscribe: (eventName: string, listener: (payload: unknown) => unknown) => () => void },
 *   elements: { button: HTMLElement, hint: HTMLElement },
 *   goToVisits: () => void,
 *   readPreferences?: () => Pick<
 *     import('#shared/domain/notification-preferences.mjs').NotificationPreferences,
 *     'windowsVisitsTodayEnabled' | 'windowsVisitSoonEnabled' | 'windowsVisitSoonMinutes'
 *   >,
 * }} dependencies
 */
export function createVisitRemindersController({
  readRecords,
  readNow,
  notifications,
  rememberedKeys,
  eventBus,
  elements: { button, hint },
  goToVisits,
  readPreferences = () => DEFAULT_NOTIFICATION_PREFERENCES,
}) {
  function checkReminders() {
    if (notifications.permission() !== 'granted') return;
    const now = readNow();
    const todayStr = isoDateOf(now);
    const tomorrowStr = shiftDays(todayStr, 1);
    const notifiedKeys = rememberedKeys.read();
    const due = selectDueReminders(readRecords().visits, now, notifiedKeys, readPreferences());
    for (const reminder of due) notifications.show(reminder.title, reminder.body, reminder.key, goToVisits);
    const nextKeys = keepCurrentKeys([...notifiedKeys, ...due.map(reminder => reminder.key)], todayStr, tomorrowStr);
    rememberedKeys.write(nextKeys);
  }

  function renderPermissionState() {
    const permission = notifications.permission();
    button.hidden = permission !== 'default';
    hint.textContent = permission === 'denied' ? BLOCKED_HINT : '';
  }

  button.onclick = () => {
    void notifications.request().then(permission => {
      button.hidden = permission !== 'default';
      hint.textContent = permission === 'denied' ? BLOCKED_HINT : '';
      if (permission === 'granted') checkReminders();
    });
  };

  renderPermissionState();
  checkReminders();
  const intervalId = setInterval(checkReminders, POLL_INTERVAL_MS);
  // Testele Node rulează fără browser: timer-ul nu trebuie să țină procesul în viață.
  intervalId.unref?.();
  const unsubscribe = eventBus.subscribe(DomainEvent.RecordsReloaded, checkReminders);

  return {
    checkReminders,
    dispose: () => {
      clearInterval(intervalId);
      unsubscribe();
    },
  };
}
