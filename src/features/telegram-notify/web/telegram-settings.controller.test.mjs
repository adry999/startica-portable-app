import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramSettingsController } from './telegram-settings.controller.mjs';

/** @typedef {import('../telegram-notify.types.mjs').TelegramStatus} TelegramStatus */

/** @param {any} value */
const asAny = value => /** @type {any} */ (value);

const NOT_CONFIGURED = /** @type {TelegramStatus} */ ({
  configured: false,
  connected: false,
  chatName: '',
  botUsername: '',
  lastRun: '',
  lastSuccess: '',
  lastError: '',
  stale: false,
});

const CONNECTED = /** @type {TelegramStatus} */ ({
  configured: true,
  connected: true,
  chatName: 'Ana Pop',
  botUsername: 'starticabot',
  lastRun: '2026-09-15T08:00:00.000Z',
  lastSuccess: '2026-09-15T08:00:00.000Z',
  lastError: '',
  stale: false,
});

/**
 * @param {{ status?: TelegramStatus, responses?: Record<string, any> }} [args]
 */
function createHarness({ status = NOT_CONFIGURED, responses = {} } = {}) {
  const notices = [];
  const calls = [];
  let currentStatus = status;
  const requestJson = async (path, body) => {
    calls.push([path, body]);
    if (path === '/api/telegram-status') return currentStatus;
    if (path in responses) {
      const outcome = responses[path];
      if (outcome instanceof Error) throw outcome;
      if (outcome?.status) currentStatus = outcome.status;
      return outcome;
    }
    throw new Error('cerere neașteptată: ' + path);
  };
  const showNotice = (...args) => notices.push(args);
  const submitButton = { disabled: false };
  const elements = {
    status: { innerHTML: '' },
    form: { onsubmit: null, querySelector: () => submitButton },
    tokenInput: { value: '' },
    testButton: { hidden: false, disabled: false, onclick: null },
    disconnectButton: { hidden: false, disabled: false, onclick: null },
  };
  const controller = createTelegramSettingsController({ elements: asAny(elements), requestJson, showNotice });
  return { elements, notices, calls, controller, submitButton, setStatus: s => (currentStatus = s) };
}

const submitForm = async elements => elements.form.onsubmit(asAny({ preventDefault: () => {} }));

test('starea neconfigurată arată „Neconfigurat.” și ascunde butoanele din toolbar', async () => {
  const { elements, controller } = createHarness({ status: NOT_CONFIGURED });

  await controller.activate();

  assert.equal(elements.status.innerHTML, '<p>Neconfigurat.</p>');
  assert.equal(elements.testButton.hidden, true);
  assert.equal(elements.disconnectButton.hidden, true);
});

test('starea conectată arată chatName, botUsername și data ultimului rezumat, cu butoanele vizibile', async () => {
  const { elements, controller } = createHarness({ status: CONNECTED });

  await controller.activate();

  assert.match(elements.status.innerHTML, /Conectat cu Ana Pop prin @starticabot/);
  assert.doesNotMatch(elements.status.innerHTML, /danger/);
  assert.equal(elements.testButton.hidden, false);
  assert.equal(elements.disconnectButton.hidden, false);
});

test('lastError prezent adaugă un paragraf de eroare separat', async () => {
  const { elements, controller } = createHarness({
    status: { ...CONNECTED, lastError: 'Token invalid sau revocat. Reconectează botul din Backup și setări.' },
  });

  await controller.activate();

  assert.match(
    elements.status.innerHTML,
    /<p class="danger">Token invalid sau revocat\. Reconectează botul din Backup și setări\.<\/p>/,
  );
});

test('stale adaugă avertismentul despre sarcina programată', async () => {
  const { elements, controller } = createHarness({ status: { ...CONNECTED, stale: true } });

  await controller.activate();

  assert.match(elements.status.innerHTML, /Rezumatul nu a mai fost trimis din/);
  assert.match(elements.status.innerHTML, /sarcina programată se reînregistrează la pornirea Startica/);
});

test('conectarea reușită golește token-ul, arată mesajul de succes și reîncarcă starea', async () => {
  const { elements, controller, notices, calls } = createHarness({
    status: NOT_CONFIGURED,
    responses: { '/api/telegram-connect': { ok: true, status: CONNECTED } },
  });
  elements.tokenInput.value = '123456789:AAHabcdefghijklmnopqrstuvwx';

  await submitForm(elements);

  assert.equal(elements.tokenInput.value, '');
  assert.deepEqual(notices, [['Bot conectat. Ai primit un mesaj de probă în Telegram.']]);
  assert.match(elements.status.innerHTML, /Conectat cu Ana Pop/);
  assert.deepEqual(
    calls.map(([path]) => path),
    ['/api/telegram-connect', '/api/telegram-status'],
  );
});

test('conectarea eșuată arată eroarea și păstrează token-ul pentru reîncercare', async () => {
  const { elements, controller, notices, calls } = createHarness({
    status: NOT_CONFIGURED,
    responses: { '/api/telegram-connect': new Error('Token invalid. Copiază-l din nou din @BotFather.') },
  });
  elements.tokenInput.value = 'abc';

  await submitForm(elements);

  assert.equal(elements.tokenInput.value, 'abc');
  assert.deepEqual(notices, [['Token invalid. Copiază-l din nou din @BotFather.', true]]);
  assert.deepEqual(
    calls.map(([path]) => path),
    ['/api/telegram-connect'],
  );
});

test('mesajul de probă reușit arată notificarea și reîncarcă starea', async () => {
  const { elements, notices, calls } = createHarness({
    status: CONNECTED,
    responses: { '/api/telegram-test': { ok: true, status: CONNECTED } },
  });

  await asAny(elements.testButton).onclick();

  assert.deepEqual(notices, [['Mesaj de probă trimis.']]);
  assert.deepEqual(
    calls.map(([path]) => path),
    ['/api/telegram-test', '/api/telegram-status'],
  );
});

test('mesajul de probă eșuat arată eroarea', async () => {
  const { elements, notices, calls } = createHarness({
    status: CONNECTED,
    responses: { '/api/telegram-test': new Error('Conectează întâi botul.') },
  });

  await asAny(elements.testButton).onclick();

  assert.deepEqual(notices, [['Conectează întâi botul.', true]]);
  assert.deepEqual(
    calls.map(([path]) => path),
    ['/api/telegram-test'],
  );
});

test('deconectarea reușită arată notificarea, reîncarcă starea și ascunde butoanele', async () => {
  const { elements, notices, calls } = createHarness({
    status: CONNECTED,
    responses: { '/api/telegram-disconnect': { ok: true, status: NOT_CONFIGURED } },
  });

  await asAny(elements.disconnectButton).onclick();

  assert.deepEqual(notices, [['Telegram deconectat.']]);
  assert.equal(elements.status.innerHTML, '<p>Neconfigurat.</p>');
  assert.equal(elements.testButton.hidden, true);
  assert.equal(elements.disconnectButton.hidden, true);
  assert.deepEqual(
    calls.map(([path]) => path),
    ['/api/telegram-disconnect', '/api/telegram-status'],
  );
});

test('deconectarea eșuată arată eroarea și lasă starea neschimbată', async () => {
  const { elements, notices, calls } = createHarness({
    status: CONNECTED,
    responses: { '/api/telegram-disconnect': new Error('Fără internet sau Telegram indisponibil.') },
  });

  await asAny(elements.disconnectButton).onclick();

  assert.deepEqual(notices, [['Fără internet sau Telegram indisponibil.', true]]);
  assert.deepEqual(
    calls.map(([path]) => path),
    ['/api/telegram-disconnect'],
  );
});
