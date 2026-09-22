import { DEFAULT_NOTIFICATION_PREFERENCES } from '#shared/domain/notification-preferences.mjs';

/** @typedef {import('#shared/domain/notification-preferences.mjs').NotificationPreferences} NotificationPreferences */

/**
 * Cache client al preferințelor de notificare (`/api/notification-settings`),
 * citit de ecranul „Notificări” și de memento-urile Windows ale vizitelor
 * (`selectDueReminders` rulează la fiecare minut, fără să receară de la server).
 * @param {{ requestJson: (path: string, body?: unknown) => Promise<any> }} dependencies
 */
export function createNotificationPreferencesStore({ requestJson }) {
  /** @type {NotificationPreferences} */
  let preferences = DEFAULT_NOTIFICATION_PREFERENCES;

  return {
    get preferences() {
      return preferences;
    },
    async load() {
      preferences = await requestJson('/api/notification-settings');
      return preferences;
    },
    /** @param {Partial<NotificationPreferences>} patch */
    async save(patch) {
      preferences = await requestJson('/api/notification-settings', patch);
      return preferences;
    },
  };
}
