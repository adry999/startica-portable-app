/** Fereastra Notification poate lipsi (headless, browsere vechi) sau localStorage poate
 * arunca într-un profil de navigare privată blocat; portul rămâne tăcut, nu aplicația. */

/**
 * @param {{ notificationApi?: typeof Notification }} [dependencies]
 */
export function createNotificationsPort({ notificationApi = globalThis.Notification } = {}) {
  return {
    permission: () => (typeof notificationApi === 'undefined' ? 'unsupported' : notificationApi.permission),
    request: () =>
      typeof notificationApi === 'undefined' ? Promise.resolve('unsupported') : notificationApi.requestPermission(),
    show: (title, body, key, onClick) => {
      if (typeof notificationApi === 'undefined') return;
      const notification = new notificationApi(title, { body, tag: key });
      notification.onclick = () => {
        window.focus();
        onClick?.();
      };
    },
  };
}

/**
 * @param {string} storageKey
 * @param {{ storage?: Storage }} [dependencies]
 */
export function createRememberedKeysPort(storageKey, { storage = globalThis.localStorage } = {}) {
  return {
    read: () => {
      try {
        const raw = storage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    write: keys => {
      try {
        storage.setItem(storageKey, JSON.stringify(keys));
      } catch {
        // Profil de navigare privată sau stocare blocată: memento-urile nu persistă, dar aplicația continuă.
      }
    },
  };
}
