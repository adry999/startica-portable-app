import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  clampNotificationPreferences,
  parseNotificationPreferences,
  isDigestRunTooLate,
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

test('isDigestRunTooLate: implicit (08:00), tăierea rămâne 18:00, ca înainte', () => {
  assert.equal(isDigestRunTooLate(new Date(2026, 8, 15, 17, 59), '08:00'), false);
  assert.equal(isDigestRunTooLate(new Date(2026, 8, 15, 18, 0), '08:00'), true);
  assert.equal(isDigestRunTooLate(new Date(2026, 8, 15, 23, 0), 'ora invalidă'), true);
});

// Audit 2026-09-22: plafonarea veche la ora 23 prăbușea grația la 0h pentru un
// rezumat setat la 23:00 (orice pornire de la 23:00 în sus era „prea târziu"
// imediat). Fără plafon, +10h trece peste miezul nopții: nimic din ziua curentă
// mai e „prea târziu” pentru o oră de rezumat atât de târzie.
test('isDigestRunTooLate: o oră de rezumat târzie nu se mai prăbușește la 0h grație', () => {
  assert.equal(isDigestRunTooLate(new Date(2026, 8, 15, 23, 30), '23:00'), false);
  assert.equal(isDigestRunTooLate(new Date(2026, 8, 15, 23, 59), '20:00'), false);
  assert.equal(isDigestRunTooLate(new Date(2026, 8, 15, 22, 30), '13:00'), false);
  assert.equal(isDigestRunTooLate(new Date(2026, 8, 15, 23, 1), '13:00'), true);
});

test('isDigestRunTooLate: o pornire chiar după miezul nopții nu e „de azi” prea târziu', () => {
  assert.equal(isDigestRunTooLate(new Date(2026, 8, 18, 0, 30), '08:00'), false);
});
