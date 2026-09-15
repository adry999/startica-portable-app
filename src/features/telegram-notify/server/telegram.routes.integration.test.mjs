import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, existsSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRouteDispatcher } from '#core/server/http/route-dispatcher.mjs';
import { createRecordingAuditTrail } from '#test-support/recording-audit-trail.mjs';
import { createTelegramRoutes } from './telegram.routes.mjs';
import { createTelegramService } from './telegram.service.mjs';
import { telegramConfigFilePath, writeTelegramConfig } from './telegram-config.repository.mjs';
import { telegramStateFilePath, writeTelegramState } from './telegram-state.repository.mjs';
import {
  createFakeTelegramApi,
  TELEGRAM_RESPONSES,
  privateChatUpdate,
  groupChatUpdate,
} from '../test-support/fake-telegram-api.mjs';

const VALID_TOKEN = '123456789:AAHtestBotToken1234567890abcXYZ';
const SESSION_TOKEN = 'test-token';

/** @returns {import('node:net').AddressInfo} */
const listeningAddress = server => /** @type {import('node:net').AddressInfo} */ (server.address());

function startTelegramServer(t, { fetch, auditTrail = createRecordingAuditTrail() } = {}) {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'startica-telegram-'));
  t.after(() => rmSync(dataDirectory, { recursive: true, force: true }));
  const telegramService = createTelegramService({ fetch });
  const routes = createTelegramRoutes({ dataDirectory, telegramService, auditTrail });
  const dispatchRequest = createRouteDispatcher({
    root: process.cwd(),
    sessionToken: SESSION_TOKEN,
    routes,
  }).dispatchRequest;
  const server = createServer((request, response) => dispatchRequest(request, response, listeningAddress(server).port));
  t.after(() => new Promise(done => server.close(done)));
  return new Promise(resolveServer =>
    server.listen(0, '127.0.0.1', () =>
      resolveServer({
        server,
        dataDirectory,
        auditTrail,
        origin: `http://127.0.0.1:${listeningAddress(server).port}`,
      }),
    ),
  );
}

const getJson = (origin, path) => fetch(origin + path).then(response => response.json());
const postJson = async (origin, path, body = {}) => {
  const response = await fetch(origin + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Startica-Token': SESSION_TOKEN },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
};

test('conectarea cu un token de format greșit întoarce 400 fără niciun apel de rețea', async t => {
  const { fetch, calls } = createFakeTelegramApi();
  const { origin, dataDirectory } = await startTelegramServer(t, { fetch });
  const response = await postJson(origin, '/api/telegram-connect', { token: 'abc' });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /Token invalid/);
  assert.equal(calls.length, 0);
  assert.equal(existsSync(telegramConfigFilePath(dataDirectory)), false);
});

test('un getMe cu 401 întoarce 400 și nu scrie niciun fișier', async t => {
  const { fetch } = createFakeTelegramApi({ getMe: TELEGRAM_RESPONSES.unauthorized });
  const { origin, dataDirectory } = await startTelegramServer(t, { fetch });
  const response = await postJson(origin, '/api/telegram-connect', { token: VALID_TOKEN });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /Token invalid/);
  assert.equal(existsSync(telegramConfigFilePath(dataDirectory)), false);
});

test('un getUpdates fără conversație privată întoarce 400 cu mesajul de Start și nu scrie niciun fișier', async t => {
  const { fetch } = createFakeTelegramApi({
    getUpdates: { status: 200, body: { ok: true, result: [groupChatUpdate()] } },
  });
  const { origin, dataDirectory } = await startTelegramServer(t, { fetch });
  const response = await postJson(origin, '/api/telegram-connect', { token: VALID_TOKEN });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /apasă Start/);
  assert.match(response.body.error, /@startica_bot/);
  assert.equal(existsSync(telegramConfigFilePath(dataDirectory)), false);
});

test('un getUpdates cu 409 (webhook activ) întoarce mesajul dedicat', async t => {
  const { fetch } = createFakeTelegramApi({ getUpdates: TELEGRAM_RESPONSES.webhookConflict });
  const { origin } = await startTelegramServer(t, { fetch });
  const response = await postJson(origin, '/api/telegram-connect', { token: VALID_TOKEN });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /webhook setat/);
});

test('rețeaua căzută la getMe întoarce mesajul tranzitoriu', async t => {
  const fetchDown = async () => {
    throw new TypeError('fetch failed');
  };
  const { origin } = await startTelegramServer(t, { fetch: fetchDown });
  const response = await postJson(origin, '/api/telegram-connect', { token: VALID_TOKEN });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'Fără internet sau Telegram indisponibil.');
});

test('o conectare reușită scrie fișierul, trimite mesajul de probă și auditează fără token', async t => {
  const { fetch, calls } = createFakeTelegramApi({
    getUpdates: {
      status: 200,
      body: {
        ok: true,
        result: [groupChatUpdate(), privateChatUpdate({ chatId: 555, firstName: 'Elena', lastName: 'Pop' })],
      },
    },
  });
  const { origin, dataDirectory, auditTrail } = await startTelegramServer(t, { fetch });
  const response = await postJson(origin, '/api/telegram-connect', { token: VALID_TOKEN });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.deepEqual(response.body.status, {
    configured: true,
    connected: true,
    chatName: 'Elena Pop',
    botUsername: 'startica_bot',
    lastRun: '',
    lastSuccess: '',
    lastError: '',
    stale: false,
  });
  assert.equal(existsSync(telegramConfigFilePath(dataDirectory)), true);

  const sendCall = calls.find(call => call.url.includes('/sendMessage'));
  assert.ok(sendCall, 'mesajul de probă a fost trimis');
  assert.equal(sendCall.body.chat_id, 555);
  assert.equal(sendCall.body.parse_mode, 'HTML');
  assert.match(sendCall.body.text, /notificările funcționează/);

  assert.equal(auditTrail.changes.length, 1);
  const [change] = auditTrail.changes;
  assert.equal(change.action, 'configurare telegram');
  assert.deepEqual(change.before, { chatId: '' });
  assert.deepEqual(change.after, { chatId: 555, chatName: 'Elena Pop', botUsername: 'startica_bot' });
  assert.equal(JSON.stringify(change).includes(VALID_TOKEN), false);
});

test('eșecul mesajului de probă după scriere lasă configurarea pe loc și întoarce eroarea clasificată', async t => {
  const { fetch } = createFakeTelegramApi({
    getUpdates: { status: 200, body: { ok: true, result: [privateChatUpdate()] } },
    sendMessage: TELEGRAM_RESPONSES.serverError,
  });
  const { origin, dataDirectory } = await startTelegramServer(t, { fetch });
  const response = await postJson(origin, '/api/telegram-connect', { token: VALID_TOKEN });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'Fără internet sau Telegram indisponibil.');
  assert.equal(existsSync(telegramConfigFilePath(dataDirectory)), true);
});

test('starea arată configurat/conectat după o conectare reușită', async t => {
  const { fetch } = createFakeTelegramApi({
    getUpdates: { status: 200, body: { ok: true, result: [privateChatUpdate()] } },
  });
  const { origin } = await startTelegramServer(t, { fetch });
  await postJson(origin, '/api/telegram-connect', { token: VALID_TOKEN });
  const status = await getJson(origin, '/api/telegram-status');
  assert.equal(status.configured, true);
  assert.equal(status.connected, true);
});

test('starea neconfigurată nu apare ca „stale”', async t => {
  const { fetch } = createFakeTelegramApi();
  const { origin } = await startTelegramServer(t, { fetch });
  const status = await getJson(origin, '/api/telegram-status');
  assert.deepEqual(status, {
    configured: false,
    connected: false,
    chatName: '',
    botUsername: '',
    lastRun: '',
    lastSuccess: '',
    lastError: '',
    stale: false,
  });
});

test('mesajul de probă cere mai întâi o conectare', async t => {
  const { fetch } = createFakeTelegramApi();
  const { origin } = await startTelegramServer(t, { fetch });
  const response = await postJson(origin, '/api/telegram-test', {});
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'Conectează întâi botul.');
});

test('mesajul de probă trimite cu configurarea existentă', async t => {
  const { fetch, calls } = createFakeTelegramApi();
  const { origin, dataDirectory } = await startTelegramServer(t, { fetch });
  writeTelegramConfig(dataDirectory, { token: VALID_TOKEN, chatId: 777, chatName: 'Ana', botUsername: 'startica_bot' });
  const response = await postJson(origin, '/api/telegram-test', {});
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  const sendCall = calls.find(call => call.url.includes('/sendMessage'));
  assert.equal(sendCall.body.chat_id, 777);
});

test('deconectarea șterge ambele fișiere și auditează', async t => {
  const { fetch } = createFakeTelegramApi();
  const { origin, dataDirectory, auditTrail } = await startTelegramServer(t, { fetch });
  writeTelegramConfig(dataDirectory, { token: VALID_TOKEN, chatId: 777, chatName: 'Ana', botUsername: 'startica_bot' });
  writeTelegramState(dataDirectory, {
    lastRun: '2026-09-14T08:00:00.000Z',
    lastSuccess: '2026-09-14T08:00:00.000Z',
    lastError: '',
    sentKeys: {},
  });

  const response = await postJson(origin, '/api/telegram-disconnect', {});
  assert.equal(response.status, 200);
  assert.equal(response.body.status.configured, false);
  assert.equal(existsSync(telegramConfigFilePath(dataDirectory)), false);
  assert.equal(existsSync(telegramStateFilePath(dataDirectory)), false);

  assert.equal(auditTrail.changes.length, 1);
  assert.deepEqual(auditTrail.changes[0].after, { chatId: '' });
  assert.deepEqual(auditTrail.changes[0].before, { chatId: 777 });
});

test('starea e „stale” după un lastSuccess vechi de 3 zile', async t => {
  const { fetch } = createFakeTelegramApi();
  const { origin, dataDirectory } = await startTelegramServer(t, { fetch });
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  writeTelegramConfig(dataDirectory, { token: VALID_TOKEN, chatId: 777, chatName: 'Ana', botUsername: 'startica_bot' });
  writeTelegramState(dataDirectory, { lastRun: threeDaysAgo, lastSuccess: threeDaysAgo, lastError: '', sentKeys: {} });
  // fișierul de configurare trebuie și el mai vechi de 48h, ca stale să reflecte o sarcină lipsă, nu doar o reconectare recentă.
  const oldTime = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  utimesSync(telegramConfigFilePath(dataDirectory), oldTime, oldTime);

  const status = await getJson(origin, '/api/telegram-status');
  assert.equal(status.stale, true);
});
