import { statSync } from 'node:fs';
import { fail } from '#core/server/errors/domain-error.mjs';
import {
  readTelegramConfig,
  writeTelegramConfig,
  removeTelegramConfig,
  telegramConfigFilePath,
} from './telegram-config.repository.mjs';
import { readTelegramState, removeTelegramState } from './telegram-state.repository.mjs';

/** @typedef {import('../telegram-notify.types.mjs').TelegramRoutesDependencies} TelegramRoutesDependencies */

const AUDIT_ACTION = 'configurare telegram';
const TEST_MESSAGE = 'Startica: notificările funcționează. Rezumatul zilnic vine la 08:00.';
const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000;

const BAD_TOKEN_MESSAGE = 'Token invalid. Copiază-l din nou din @BotFather.';
const WEBHOOK_CONFLICT_MESSAGE = 'Botul are un webhook setat; creează un bot nou pentru Startica.';
const NOT_CONNECTED_MESSAGE = 'Conectează întâi botul.';

const startButtonMessage = botUsername =>
  `Deschide botul @${botUsername} în Telegram, apasă Start, apoi apasă din nou „Conectează”.`;

function isOlderThan48h(isoString) {
  if (!isoString) return true;
  const time = Date.parse(isoString);
  return Number.isNaN(time) || Date.now() - time > STALE_THRESHOLD_MS;
}

// Serverul nu interoghează Task Scheduler; fișierul de configurare vechi de
// 48 h e semnalul vizibil pentru o sarcină programată lipsă sau dezactivată.
function isConfigFileStale(dataDirectory) {
  try {
    return Date.now() - statSync(telegramConfigFilePath(dataDirectory)).mtimeMs > STALE_THRESHOLD_MS;
  } catch {
    return true;
  }
}

function isWebhookConflict(error) {
  return error?.error_code === 409 || error?.status === 409;
}

/** @param {unknown} error @returns {error is Error & { telegramReason?: string }} */
function isTelegramError(error) {
  return error instanceof Error;
}

/** @param {TelegramRoutesDependencies} dependencies */
export function createTelegramRoutes({ dataDirectory, telegramService, auditTrail }) {
  // Cele patru apeluri Telegram (getMe, findPrivateChat, sendMessage × 2) au
  // aceeași formă: clasifică eșecul și oprește cererea; doar mesajul diferă.
  /**
   * @template T
   * @param {() => Promise<T>} action
   * @param {(failure: import('../telegram-notify.types.mjs').TelegramFailure, error: unknown) => string} [translate]
   * @returns {Promise<T>}
   */
  async function callTelegramOrFail(action, translate = failure => failure.message) {
    try {
      return await action();
    } catch (error) {
      const failure = telegramService.classifyTelegramFailure(error);
      fail(translate(failure, error));
    }
  }

  function buildStatus() {
    const config = readTelegramConfig(dataDirectory);
    const state = readTelegramState(dataDirectory);
    const configured = !!config;
    const connected = configured && !!config.chatId;
    return {
      configured,
      connected,
      chatName: config?.chatName || '',
      botUsername: config?.botUsername || '',
      lastRun: state.lastRun,
      lastSuccess: state.lastSuccess,
      lastError: state.lastError,
      stale: connected && isOlderThan48h(state.lastSuccess) && isConfigFileStale(dataDirectory),
    };
  }

  async function connect(token) {
    const botUsername = await callTelegramOrFail(
      () => telegramService.getMe(token),
      failure => (failure.kind === 'transient' ? failure.message : BAD_TOKEN_MESSAGE),
    );

    const chat = await callTelegramOrFail(
      () => telegramService.findPrivateChat(token),
      (failure, error) => {
        if (isTelegramError(error) && error.telegramReason === 'no-private-chat')
          return startButtonMessage(botUsername);
        if (isWebhookConflict(error)) return WEBHOOK_CONFLICT_MESSAGE;
        return failure.message;
      },
    );

    const before = readTelegramConfig(dataDirectory);
    writeTelegramConfig(dataDirectory, { token, chatId: chat.chatId, chatName: chat.chatName, botUsername });

    // Eșecul mesajului de probă DUPĂ scrierea fișierului lasă configurarea pe
    // loc și întoarce doar eroarea clasificată: botul e deja verificat funcțional.
    await callTelegramOrFail(() => telegramService.sendMessage({ token, chatId: chat.chatId, text: TEST_MESSAGE }));

    auditTrail.recordChange({
      action: AUDIT_ACTION,
      recordType: null,
      recordId: null,
      before: { chatId: before?.chatId || '' },
      after: { chatId: chat.chatId, chatName: chat.chatName, botUsername },
    });
    return { ok: true, status: buildStatus() };
  }

  async function sendTestMessage() {
    const config = readTelegramConfig(dataDirectory);
    if (!config?.chatId) fail(NOT_CONNECTED_MESSAGE);
    await callTelegramOrFail(() =>
      telegramService.sendMessage({ token: config.token, chatId: config.chatId, text: TEST_MESSAGE }),
    );
    return { ok: true, status: buildStatus() };
  }

  function disconnect() {
    const before = readTelegramConfig(dataDirectory);
    removeTelegramConfig(dataDirectory);
    removeTelegramState(dataDirectory);
    auditTrail.recordChange({
      action: AUDIT_ACTION,
      recordType: null,
      recordId: null,
      before: { chatId: before?.chatId || '' },
      after: { chatId: '' },
    });
    return { ok: true, status: buildStatus() };
  }

  return [
    { method: 'GET', path: '/api/telegram-status', handle: () => buildStatus() },
    {
      method: 'POST',
      path: '/api/telegram-connect',
      /** @param {{ body: any }} request */ handle: ({ body }) => connect(body?.token),
    },
    { method: 'POST', path: '/api/telegram-test', handle: () => sendTestMessage() },
    { method: 'POST', path: '/api/telegram-disconnect', handle: () => disconnect() },
  ];
}
