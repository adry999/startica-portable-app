import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  clampNotificationPreferences,
  parseNotificationPreferences,
  lateRunHourFor,
} from './notification-preferences.mjs';

test('clampNotificationPreferences completează cu implicite când nu primește nimic', () => {
  assert.deepEqual(clampNotificationPreferences(null), DEFAULT_NOTIFICATION_PREFERENCES);
  assert.deepEqual(clampNotificationPreferences(undefined), DEFAULT_NOTIFICATION_PREFERENCES);
  assert.deepEqual(clampNotificationPreferences({}), DEFAULT_NOTIFICATION_PREFERENCES);
});

test('clampNotificationPreferences limitează numerele la interval', () => {
  const prefs = clampNotificationPreferences({
    birthdaysDaysBefore: -5,
    visitsHorizonDays: 999,
    windowsVisitSoonMinutes: 1,
  });
  assert.equal(prefs.birthdaysDaysBefore, 0);
  assert.equal(prefs.visitsHorizonDays, 14);
  assert.equal(prefs.windowsVisitSoonMinutes, 5);
});

test('clampNotificationPreferences respinge o cadență necunoscută', () => {
  assert.equal(
    clampNotificationPreferences(/** @type {any} */ ({ overdueCadence: 'weekly' })).overdueCadence,
    'monday',
  );
  assert.equal(clampNotificationPreferences({ overdueCadence: 'daily' }).overdueCadence, 'daily');
});

test('clampNotificationPreferences respinge o oră cu formă greșită', () => {
  assert.equal(clampNotificationPreferences({ digestTime: '8:00' }).digestTime, '08:00');
  assert.equal(clampNotificationPreferences({ digestTime: '25:00' }).digestTime, '08:00');
  assert.equal(clampNotificationPreferences({ digestTime: '19:30' }).digestTime, '19:30');
});

test('clampNotificationPreferences păstrează boolean false, nu doar truthy', () => {
  assert.equal(clampNotificationPreferences({ birthdaysEnabled: false }).birthdaysEnabled, false);
});

test('parseNotificationPreferences pe JSON corupt revine la implicite, fără să arunce', () => {
  assert.deepEqual(parseNotificationPreferences('{nu e json'), DEFAULT_NOTIFICATION_PREFERENCES);
  assert.deepEqual(parseNotificationPreferences(''), DEFAULT_NOTIFICATION_PREFERENCES);
});

test('parseNotificationPreferences pe JSON parțial completează restul', () => {
  const prefs = parseNotificationPreferences(JSON.stringify({ digestTime: '09:15' }));
  assert.equal(prefs.digestTime, '09:15');
  assert.equal(prefs.birthdaysDaysBefore, DEFAULT_NOTIFICATION_PREFERENCES.birthdaysDaysBefore);
});

test('lateRunHourFor adaugă 10 ore la ora rezumatului, plafonat la 23', () => {
  assert.equal(lateRunHourFor('08:00'), 18);
  assert.equal(lateRunHourFor('20:00'), 23);
  assert.equal(lateRunHourFor('ora invalidă'), 18);
});
