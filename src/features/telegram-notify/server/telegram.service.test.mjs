import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramService, classifyTelegramFailure } from './telegram.service.mjs';
import {
  createFakeTelegramApi,
  TELEGRAM_RESPONSES,
  privateChatUpdate,
  groupChatUpdate,
} from '../test-support/fake-telegram-api.mjs';

const VALID_TOKEN = '123456789:AAHtestBotToken1234567890abcXYZ';

test('classifyTelegramFailure: TypeError „fetch failed” e tranzitoriu', () => {
  const { kind, message } = classifyTelegramFailure(new TypeError('fetch failed'));
  assert.equal(kind, 'transient');
  assert.equal(message, 'Fără internet sau Telegram indisponibil.');
});

test('classifyTelegramFailure: AbortError e tranzitoriu', () => {
  const error = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
  const { kind } = classifyTelegramFailure(error);
  assert.equal(kind, 'transient');
});

test('classifyTelegramFailure: 5xx e tranzitoriu', () => {
  const error = Object.assign(new Error('Bad Gateway'), { status: 502, error_code: 502 });
  const { kind } = classifyTelegramFailure(error);
  assert.equal(kind, 'transient');
});

test('classifyTelegramFailure: 429 e tranzitoriu', () => {
  const error = Object.assign(new Error('Too Many Requests'), { error_code: 429, parameters: { retry_after: 3 } });
  const { kind } = classifyTelegramFailure(error);
  assert.equal(kind, 'transient');
});

test('classifyTelegramFailure: 401 e permanent, cu mesajul de token invalid', () => {
  const error = Object.assign(new Error('Unauthorized'), { error_code: 401 });
  const { kind, message } = classifyTelegramFailure(error);
  assert.equal(kind, 'permanent');
  assert.equal(message, 'Token invalid sau revocat. Reconectează botul din Backup și setări.');
});

test('classifyTelegramFailure: 400 „chat not found” e permanent, cu mesajul de conversație pierdută', () => {
  const error = Object.assign(new Error('Bad Request: chat not found'), {
    error_code: 400,
    description: 'Bad Request: chat not found',
  });
  const { kind, message } = classifyTelegramFailure(error);
  assert.equal(kind, 'permanent');
  assert.equal(message, 'Conversația cu botul nu mai există. Deschide botul, apasă Start și reconectează.');
});

test('classifyTelegramFailure: 403 „bot was blocked by the user” e permanent, cu mesajul de conversație pierdută', () => {
  const error = Object.assign(new Error('Forbidden: bot was blocked by the user'), {
    error_code: 403,
    description: 'Forbidden: bot was blocked by the user',
  });
  const { kind, message } = classifyTelegramFailure(error);
  assert.equal(kind, 'permanent');
  assert.equal(message, 'Conversația cu botul nu mai există. Deschide botul, apasă Start și reconectează.');
});

test('classifyTelegramFailure: un ok:false necunoscut e permanent, cu descrierea Telegram', () => {
  const error = Object.assign(new Error('Message is too long'), {
    error_code: 400,
    description: 'Message is too long',
  });
  const { kind, message } = classifyTelegramFailure(error);
  assert.equal(kind, 'permanent');
  assert.equal(message, 'Telegram a refuzat mesajul: Message is too long');
});

test('getMe respinge sincron un token cu format greșit, fără niciun apel', async () => {
  const { fetch, calls } = createFakeTelegramApi();
  const service = createTelegramService({ fetch });
  await assert.rejects(() => service.getMe('abc'));
  assert.equal(calls.length, 0);
});

test('getMe întoarce numele botului la succes', async () => {
  const { fetch } = createFakeTelegramApi();
  const service = createTelegramService({ fetch });
  assert.equal(await service.getMe(VALID_TOKEN), 'startica_bot');
});

test('sendMessage trimite chat_id, text și parse_mode HTML', async () => {
  const { fetch, calls } = createFakeTelegramApi();
  const service = createTelegramService({ fetch });
  await service.sendMessage({ token: VALID_TOKEN, chatId: 42, text: 'Salut' });
  const call = calls.find(c => c.url.includes('/sendMessage'));
  assert.equal(call.body.chat_id, 42);
  assert.equal(call.body.text, 'Salut');
  assert.equal(call.body.parse_mode, 'HTML');
});

test('sendMessage trimite bucățile în ordine și se oprește la prima eroare', async () => {
  const longText = Array.from({ length: 100 }, (_, i) => `linia ${i}: ${'x'.repeat(60)}`).join('\n');
  const { fetch, calls } = createFakeTelegramApi({
    sendMessage: [
      { status: 200, body: { ok: true, result: {} } },
      TELEGRAM_RESPONSES.refused,
      { status: 200, body: { ok: true, result: {} } },
    ],
  });
  const service = createTelegramService({ fetch });
  await assert.rejects(() => service.sendMessage({ token: VALID_TOKEN, chatId: 1, text: longText }));
  const sendCalls = calls.filter(c => c.url.includes('/sendMessage'));
  assert.equal(sendCalls.length, 2, 'a treia bucată nu se mai trimite după eșecul celei de-a doua');
});

test('findPrivateChat alege ultima conversație privată și ignoră grupurile', async () => {
  const { fetch } = createFakeTelegramApi({
    getUpdates: {
      status: 200,
      body: {
        ok: true,
        result: [
          privateChatUpdate({ chatId: 10, firstName: 'Prima' }),
          groupChatUpdate(),
          privateChatUpdate({ chatId: 20, firstName: 'Elena', lastName: 'Pop' }),
        ],
      },
    },
  });
  const service = createTelegramService({ fetch });
  const chat = await service.findPrivateChat(VALID_TOKEN);
  assert.deepEqual(chat, { chatId: 20, chatName: 'Elena Pop' });
});

test('findPrivateChat aruncă o eroare distinctă când nu există nicio conversație privată', async () => {
  const { fetch } = createFakeTelegramApi({
    getUpdates: { status: 200, body: { ok: true, result: [groupChatUpdate()] } },
  });
  const service = createTelegramService({ fetch });
  await assert.rejects(
    () => service.findPrivateChat(VALID_TOKEN),
    error => {
      assert.equal(error.telegramReason, 'no-private-chat');
      return true;
    },
  );
});
