import test from 'node:test';
import assert from 'node:assert/strict';
import { selectDueReminders } from './visit-reminders.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Visit} Visit */

/** @returns {Visit} */
function buildVisit(overrides = {}) {
  return {
    id: 'VIZ-1',
    name: 'Ana Popescu',
    parent: 'Maria Popescu',
    phone: '0722000000',
    status: 'Programată',
    date: '2026-09-10',
    time: '10:00',
    statusChangedAt: '2026-09-01T10:00:00.000Z',
    history: [],
    desiredGroupId: null,
    childId: '',
    archived: false,
    ...overrides,
  };
}

test('selectDueReminders întoarce o singură notificare "zi" pentru vizitele de azi', () => {
  const now = new Date('2026-09-10T08:00:00');
  const visits = [
    buildVisit({ id: 'VIZ-1', date: '2026-09-10', time: '09:00', name: 'Ana' }),
    buildVisit({ id: 'VIZ-2', date: '2026-09-10', time: '11:30', name: 'Ion' }),
  ];

  const reminders = selectDueReminders(visits, now, []);
  const dayReminder = reminders.find(r => r.key === 'zi:2026-09-10');

  assert.ok(dayReminder);
  assert.equal(dayReminder.title, 'Vizite azi');
  assert.equal(dayReminder.body, '2 vizite: 09:00 Ana, 11:30 Ion');
});

test('selectDueReminders sare notificarea "zi" deja trimisă', () => {
  const now = new Date('2026-09-10T08:00:00');
  const visits = [buildVisit({ date: '2026-09-10', time: '09:00' })];

  const reminders = selectDueReminders(visits, now, ['zi:2026-09-10']);

  assert.equal(
    reminders.some(r => r.key === 'zi:2026-09-10'),
    false,
  );
});

test('selectDueReminders adaugă o notificare per vizită în fereastra de 30 de minute', () => {
  const now = new Date('2026-09-10T09:45:00');
  const visits = [buildVisit({ id: 'VIZ-1', date: '2026-09-10', time: '10:00', name: 'Ana', phone: '0722000000' })];

  const reminders = selectDueReminders(visits, now, []);
  const visitReminder = reminders.find(r => r.key === 'vizita:VIZ-1:2026-09-10:10:00');

  assert.ok(visitReminder);
  assert.equal(visitReminder.title, 'Vizită peste 15 min');
  assert.equal(visitReminder.body, '10:00 · Ana · 0722000000');
});

test('selectDueReminders ignoră vizitele în afara ferestrei de 30 de minute și pe cele deja trecute', () => {
  const now = new Date('2026-09-10T09:00:00');
  const tooFar = buildVisit({ id: 'VIZ-1', date: '2026-09-10', time: '10:00' });
  const alreadyPassed = buildVisit({ id: 'VIZ-2', date: '2026-09-10', time: '08:59' });

  const reminders = selectDueReminders([tooFar, alreadyPassed], now, []);

  assert.equal(
    reminders.some(r => r.key.startsWith('vizita:')),
    false,
  );
});

test('selectDueReminders sare cheia vizitei deja notificate', () => {
  const now = new Date('2026-09-10T09:45:00');
  const visits = [buildVisit({ id: 'VIZ-1', date: '2026-09-10', time: '10:00' })];

  const reminders = selectDueReminders(visits, now, ['zi:2026-09-10', 'vizita:VIZ-1:2026-09-10:10:00']);

  assert.equal(reminders.length, 0);
});

test('selectDueReminders ignoră vizitele nearhivate cu alt statut și pe cele arhivate', () => {
  const now = new Date('2026-09-10T09:45:00');
  const visits = [
    buildVisit({ id: 'VIZ-1', date: '2026-09-10', time: '10:00', status: 'Efectuată' }),
    buildVisit({ id: 'VIZ-2', date: '2026-09-10', time: '10:00', archived: true }),
  ];

  const reminders = selectDueReminders(visits, now, []);

  assert.equal(reminders.length, 0);
});
