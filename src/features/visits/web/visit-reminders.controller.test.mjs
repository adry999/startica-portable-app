import test from 'node:test';
import assert from 'node:assert/strict';
import { createDomainEventBus } from '#core/web/domain-event-bus.mjs';
import { DomainEvent } from '#shared/contracts/domain-events.mjs';
import { scheduledVisit } from '../test-support/visit-record-fixtures.mjs';
import { createVisitRemindersController } from './visit-reminders.controller.mjs';

/** @param {any} value */
const asAny = value => /** @type {any} */ (value);

/** @param {{ initialPermission?: string, requestResolvesTo?: string }} [options] */
function createFakeNotifications({ initialPermission = 'default', requestResolvesTo = 'granted' } = {}) {
  let permission = initialPermission;
  const shown = [];
  return {
    port: {
      permission: () => permission,
      request: () => {
        permission = requestResolvesTo;
        return Promise.resolve(permission);
      },
      show: (title, body, key, onClick) => shown.push({ title, body, key, onClick }),
    },
    shown,
  };
}

/** @param {string[]} [initialKeys] */
function createFakeRememberedKeys(initialKeys = []) {
  let stored = [...initialKeys];
  const writes = [];
  return {
    port: {
      read: () => [...stored],
      write: keys => {
        writes.push([...keys]);
        stored = [...keys];
      },
    },
    writes,
  };
}

function createElements() {
  return {
    button: /** @type {any} */ ({ hidden: false, onclick: null }),
    hint: /** @type {any} */ ({ textContent: '' }),
  };
}

/** @param {{ notificationsOptions?: any, initialKeys?: string[], visits?: any[] }} [args] */
function createHarness({ notificationsOptions = {}, initialKeys = [], visits = [] } = {}) {
  const fakeNotifications = createFakeNotifications(notificationsOptions);
  const fakeRememberedKeys = createFakeRememberedKeys(initialKeys);
  const elements = createElements();
  const eventBus = createDomainEventBus({ eventNames: [DomainEvent.RecordsReloaded], onListenerError: () => {} });
  const goToVisitsCalls = [];
  const records = asAny({ children: [], payments: [], expenses: [], groups: [], categories: [], visits });

  const controller = createVisitRemindersController({
    readRecords: () => records,
    readNow: () => new Date(2026, 8, 15, 9, 0, 0),
    notifications: asAny(fakeNotifications.port),
    rememberedKeys: fakeRememberedKeys.port,
    eventBus,
    elements,
    goToVisits: () => goToVisitsCalls.push(true),
  });

  return { controller, elements, eventBus, goToVisitsCalls, ...fakeNotifications, ...fakeRememberedKeys };
}

test('butonul e vizibil doar cât permisiunea e „default”', () => {
  const { elements } = createHarness({ notificationsOptions: { initialPermission: 'default' } });
  assert.equal(elements.button.hidden, false);
  assert.equal(elements.hint.textContent, '');
});

test('permisiunea „granted” ascunde butonul și nu arată niciun indiciu', () => {
  const { elements } = createHarness({ notificationsOptions: { initialPermission: 'granted' } });
  assert.equal(elements.button.hidden, true);
  assert.equal(elements.hint.textContent, '');
});

test('permisiunea „denied” ascunde butonul și arată indiciul de blocare', () => {
  const { elements } = createHarness({ notificationsOptions: { initialPermission: 'denied' } });
  assert.equal(elements.button.hidden, true);
  assert.match(elements.hint.textContent, /blocate în browser/);
});

test('fără Notification (unsupported) butonul rămâne ascuns, fără indiciu', () => {
  const { elements } = createHarness({ notificationsOptions: { initialPermission: 'unsupported' } });
  assert.equal(elements.button.hidden, true);
  assert.equal(elements.hint.textContent, '');
});

test('clic pe buton cere permisiunea și, la „granted”, ascunde butonul', async () => {
  const { elements } = createHarness({
    notificationsOptions: { initialPermission: 'default', requestResolvesTo: 'granted' },
  });
  elements.button.onclick();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(elements.button.hidden, true);
  assert.equal(elements.hint.textContent, '');
});

test('clic pe buton cere permisiunea și, la „denied”, arată indiciul de blocare', async () => {
  const { elements } = createHarness({
    notificationsOptions: { initialPermission: 'default', requestResolvesTo: 'denied' },
  });
  elements.button.onclick();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(elements.button.hidden, true);
  assert.match(elements.hint.textContent, /blocate în browser/);
});

test('cu permisiunea acordată, trimite o notificare „Vizite azi” la pornire', () => {
  const { shown } = createHarness({
    notificationsOptions: { initialPermission: 'granted' },
    visits: [scheduledVisit({ date: '2026-09-15', time: '10:00' })],
  });
  assert.equal(shown.length, 1);
  assert.match(shown[0].title, /Vizite azi/);
});

test('nu trimite a doua oară aceeași notificare la un nou tur de verificare', () => {
  const { controller, shown } = createHarness({
    notificationsOptions: { initialPermission: 'granted' },
    visits: [scheduledVisit({ date: '2026-09-15', time: '10:00' })],
  });
  assert.equal(shown.length, 1);
  controller.checkReminders();
  controller.checkReminders();
  assert.equal(shown.length, 1);
});

test('la records.reloaded, verifică din nou memento-urile fără duplicate', () => {
  const { eventBus, shown } = createHarness({
    notificationsOptions: { initialPermission: 'granted' },
    visits: [scheduledVisit({ date: '2026-09-15', time: '10:00' })],
  });
  assert.equal(shown.length, 1);
  eventBus.publish(DomainEvent.RecordsReloaded, {});
  assert.equal(shown.length, 1);
});

test('cheile trimise sunt persistate prin rememberedKeys.write', () => {
  const { writes } = createHarness({
    notificationsOptions: { initialPermission: 'granted' },
    visits: [scheduledVisit({ date: '2026-09-15', time: '10:00' })],
  });
  assert.ok(writes.length >= 1);
  assert.deepEqual(writes.at(-1), ['zi:2026-09-15']);
});

test('cheile vechi, irelevante pentru azi sau mâine, sunt eliminate la verificare', () => {
  const { writes } = createHarness({
    notificationsOptions: { initialPermission: 'granted' },
    initialKeys: ['zi:2020-01-01', 'vizita:VIZ-9:2020-01-01:09:00'],
    visits: [],
  });
  assert.deepEqual(writes.at(-1), []);
});

test('nu verifică memento-urile cât permisiunea nu e „granted”', () => {
  const { shown, writes } = createHarness({
    notificationsOptions: { initialPermission: 'default' },
    visits: [scheduledVisit({ date: '2026-09-15', time: '10:00' })],
  });
  assert.equal(shown.length, 0);
  assert.equal(writes.length, 0);
});

test('clicul de pe notificare cheamă goToVisits', () => {
  const { shown, goToVisitsCalls } = createHarness({
    notificationsOptions: { initialPermission: 'granted' },
    visits: [scheduledVisit({ date: '2026-09-15', time: '10:00' })],
  });
  shown[0].onClick();
  assert.deepEqual(goToVisitsCalls, [true]);
});
