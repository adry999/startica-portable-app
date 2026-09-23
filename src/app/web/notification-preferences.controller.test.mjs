import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotificationPreferencesController } from './notification-preferences.controller.mjs';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '#shared/domain/notification-preferences.mjs';

/** @param {any} value */
const asAny = value => /** @type {any} */ (value);

function fakeCheckbox(checked = false) {
  return { checked };
}
function fakeField(value = '') {
  return { value };
}

/**
 * @param {{
 *   storeResponse?: import('#shared/domain/notification-preferences.mjs').NotificationPreferences,
 *   saveResponse?: import('#shared/domain/notification-preferences.mjs').NotificationPreferences,
 *   saveError?: Error,
 * }} [args]
 */
function createHarness({ storeResponse = DEFAULT_NOTIFICATION_PREFERENCES, saveResponse, saveError } = {}) {
  const notices = [];
  const saveCalls = [];
  const submitButton = { disabled: false };
  const formListeners = {};
  const saveBar = { hidden: true };
  const elements = {
    form: {
      onsubmit: null,
      querySelector: () => submitButton,
      addEventListener: (type, handler) => {
        formListeners[type] = handler;
      },
    },
    saveBar,
    birthdaysEnabled: fakeCheckbox(true),
    birthdaysDaysBefore: fakeField('2'),
    visitsEnabled: fakeCheckbox(true),
    visitsHorizonDays: fakeField('1'),
    overdueEnabled: fakeCheckbox(true),
    overdueCadence: fakeField('monday'),
    nothingToReportEnabled: fakeCheckbox(true),
    digestTime: fakeField('08:00'),
    windowsVisitsTodayEnabled: fakeCheckbox(true),
    windowsVisitSoonEnabled: fakeCheckbox(true),
    windowsVisitSoonMinutes: fakeField('30'),
  };
  const store = {
    load: async () => storeResponse,
    save: async patch => {
      saveCalls.push(patch);
      if (saveError) throw saveError;
      return saveResponse ?? storeResponse;
    },
  };
  const showNotice = (...args) => notices.push(args);
  const controller = createNotificationPreferencesController({ elements: asAny(elements), store, showNotice });
  return { elements, notices, saveCalls, controller, submitButton, saveBar, fireInput: () => formListeners.input?.() };
}

const submitForm = async elements => elements.form.onsubmit(asAny({ preventDefault: () => {} }));

test('activate() umple formularul cu preferințele din store', async () => {
  const { elements, controller } = createHarness({
    storeResponse: { ...DEFAULT_NOTIFICATION_PREFERENCES, birthdaysEnabled: false, digestTime: '09:15' },
  });

  await controller.activate();

  assert.equal(elements.birthdaysEnabled.checked, false);
  assert.equal(elements.digestTime.value, '09:15');
});

test('trimiterea formularului citește toate câmpurile, inclusiv un checkbox debifat', async () => {
  const { elements, saveCalls } = createHarness();
  elements.birthdaysEnabled.checked = false;
  elements.overdueCadence.value = 'daily';

  await submitForm(elements);

  assert.equal(saveCalls.length, 1);
  assert.equal(saveCalls[0].birthdaysEnabled, false);
  assert.equal(saveCalls[0].overdueCadence, 'daily');
  assert.equal(saveCalls[0].birthdaysDaysBefore, 2);
});

test('salvarea reușită arată notificarea și reumple formularul cu răspunsul', async () => {
  const { elements, notices } = createHarness({
    saveResponse: { ...DEFAULT_NOTIFICATION_PREFERENCES, windowsVisitSoonMinutes: 45 },
  });

  await submitForm(elements);

  assert.deepEqual(notices, [['Preferințele de notificare au fost salvate.']]);
  assert.equal(elements.windowsVisitSoonMinutes.value, '45');
});

test('salvarea eșuată arată eroarea și reactivează butonul', async () => {
  const { notices, submitButton, elements } = createHarness({ saveError: new Error('Rețea indisponibilă.') });

  await submitForm(elements);

  assert.deepEqual(notices, [['Rețea indisponibilă.', true]]);
  assert.equal(submitButton.disabled, false);
});

test('activate() lasă bara de salvare ascunsă', async () => {
  const { controller, saveBar } = createHarness();

  await controller.activate();

  assert.equal(saveBar.hidden, true);
});

test('o editare arată bara de salvare', async () => {
  const { controller, elements, saveBar, fireInput } = createHarness();
  await controller.activate();

  elements.digestTime.value = '09:15';
  fireInput();

  assert.equal(saveBar.hidden, false);
});

test('revenirea la valoarea încărcată ascunde bara de salvare la loc', async () => {
  const { controller, elements, saveBar, fireInput } = createHarness();
  await controller.activate();

  elements.digestTime.value = '09:15';
  fireInput();
  assert.equal(saveBar.hidden, false);

  elements.digestTime.value = '08:00';
  fireInput();

  assert.equal(saveBar.hidden, true);
});

test('salvarea reușită ascunde din nou bara de salvare', async () => {
  const { controller, elements, saveBar, fireInput } = createHarness();
  await controller.activate();
  elements.digestTime.value = '09:15';
  fireInput();

  await submitForm(elements);

  assert.equal(saveBar.hidden, true);
});

test('salvarea eșuată lasă bara de salvare vizibilă', async () => {
  const { controller, elements, saveBar, fireInput } = createHarness({
    saveError: new Error('Rețea indisponibilă.'),
  });
  await controller.activate();
  elements.digestTime.value = '09:15';
  fireInput();

  await submitForm(elements);

  assert.equal(saveBar.hidden, false);
});
