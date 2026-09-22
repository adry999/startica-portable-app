import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotificationPreferencesStore } from './notification-preferences-store.mjs';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '#shared/domain/notification-preferences.mjs';

test('preferences începe pe implicite, înainte de orice load()', () => {
  const store = createNotificationPreferencesStore({ requestJson: async () => ({}) });
  assert.deepEqual(store.preferences, DEFAULT_NOTIFICATION_PREFERENCES);
});

test('load() actualizează preferences cu răspunsul serverului', async () => {
  const server = { ...DEFAULT_NOTIFICATION_PREFERENCES, birthdaysEnabled: false };
  const store = createNotificationPreferencesStore({ requestJson: async () => server });

  const loaded = await store.load();

  assert.equal(loaded.birthdaysEnabled, false);
  assert.equal(store.preferences.birthdaysEnabled, false);
});

test('save() trimite patch-ul și actualizează preferences cu răspunsul', async () => {
  const calls = [];
  const store = createNotificationPreferencesStore({
    requestJson: async (path, body) => {
      calls.push([path, body]);
      return { ...DEFAULT_NOTIFICATION_PREFERENCES, digestTime: '09:00' };
    },
  });

  await store.save({ digestTime: '09:00' });

  assert.deepEqual(calls, [['/api/notification-settings', { digestTime: '09:00' }]]);
  assert.equal(store.preferences.digestTime, '09:00');
});
