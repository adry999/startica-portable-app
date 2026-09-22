import { splitDigest } from '../domain/daily-digest.mjs';

/** @typedef {import('../telegram-notify.types.mjs').TelegramFailure} TelegramFailure */
/** @typedef {import('../telegram-notify.types.mjs').TelegramService} TelegramService */

const TELEGRAM_API_ROOT = 'https://api.telegram.org';
const REQUEST_TIMEOUT_MS = 15000;
const TOKEN_FORMAT = /^\d+:[\w-]{20,}$/;

const NETWORK_MESSAGE = 'Fără internet sau Telegram indisponibil.';
const TOKEN_INVALID_MESSAGE = 'Token invalid sau revocat. Reconectează botul din Backup și setări.';
const CHAT_GONE_MESSAGE = 'Conversația cu botul nu mai există. Deschide botul, apasă Start și reconectează.';

// Node aruncă TypeError('fetch failed') pentru DNS/rețea; AbortSignal.timeout
// produce un DOMException 'AbortError' la expirare — ambele sunt tranzitorii.
function isNetworkError(error) {
  if (!error) return false;
  if (error.name === 'AbortError') return true;
  return error instanceof TypeError && /fetch failed/i.test(error.message);
}

/**
 * Clasificarea eșecurilor Bot API, într-un singur loc (§6 din specificație).
 * @param {unknown} error
 * @returns {TelegramFailure}
 */
export function classifyTelegramFailure(error) {
  const failure = /** @type {any} */ (error);
  if (isNetworkError(failure)) return { kind: 'transient', message: NETWORK_MESSAGE };
  const status = failure?.status;
  const code = failure?.error_code;
  if (code === 429 || (status >= 500 && status < 600)) return { kind: 'transient', message: NETWORK_MESSAGE };
  if (code === 401 || status === 401) return { kind: 'permanent', message: TOKEN_INVALID_MESSAGE };
  const description = String(failure?.description || failure?.message || '');
  if ((code === 400 || status === 400) && /chat not found/i.test(description))
    return { kind: 'permanent', message: CHAT_GONE_MESSAGE };
  if ((code === 403 || status === 403) && /bot was blocked by the user/i.test(description))
    return { kind: 'permanent', message: CHAT_GONE_MESSAGE };
  return { kind: 'permanent', message: `Telegram a refuzat mesajul: ${description || 'eroare necunoscută'}` };
}

/**
 * @param {string} token
 * @returns {asserts token is string}
 */
function assertValidTokenFormat(token) {
  if (typeof token !== 'string' || !TOKEN_FORMAT.test(token))
    throw Object.assign(new Error('Format de token invalid.'), { telegramReason: 'invalid-format' });
}

/**
 * @param {typeof fetch} fetchImpl
 * @param {string} token
 * @param {string} method
 * @param {Record<string, unknown>} [params]
 * @param {{ post?: boolean }} [options]
 */
async function callTelegramApi(fetchImpl, token, method, params, { post = false } = {}) {
  const url = new URL(`${TELEGRAM_API_ROOT}/bot${token}/${method}`);
  if (!post && params) for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetchImpl(url.toString(), {
    method: post ? 'POST' : 'GET',
    headers: post ? { 'Content-Type': 'application/json' } : undefined,
    body: post ? JSON.stringify(params) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const json = await response.json().catch(() => null);
  if (!json || json.ok !== true) {
    const description = json?.description || `Eroare HTTP ${response.status}`;
    throw Object.assign(new Error(description), {
      status: response.status,
      error_code: json?.error_code ?? response.status,
      description,
      parameters: json?.parameters,
    });
  }
  return json.result;
}

/**
 * @param {{ fetch: typeof fetch }} dependencies
 * @returns {TelegramService}
 */
export function createTelegramService({ fetch: fetchImpl }) {
  /** @param {string} token */
  async function getMe(token) {
    assertValidTokenFormat(token);
    const result = await callTelegramApi(fetchImpl, token, 'getMe');
    return result.username;
  }

  // Reține ultima conversație validă, ca operatorul să nu vadă niciodată un „chat
  // id” de copiat: o conversație privată (orice mesaj) sau un grup/supergrup, dar
  // acolo doar la comanda /start — cu „Privacy mode” pornit din oficiu în BotFather,
  // Telegram nu livrează botului alte mesaje din grup, doar comenzi și mențiuni.
  /** @param {string} token */
  async function findConnectedChat(token) {
    const updates = await callTelegramApi(fetchImpl, token, 'getUpdates', { limit: 100 });
    const validChats = updates.filter(update => {
      const chat = update.message?.chat;
      if (!chat) return false;
      if (chat.type === 'private') return true;
      if (chat.type === 'group' || chat.type === 'supergroup') return update.message.text?.startsWith('/start');
      return false;
    });
    if (!validChats.length)
      throw Object.assign(new Error('Nicio conversație găsită.'), { telegramReason: 'no-chat-found' });
    const chat = validChats[validChats.length - 1].message.chat;
    const chatName =
      chat.type === 'private' ? chat.first_name + (chat.last_name ? ' ' + chat.last_name : '') : chat.title;
    return { chatId: chat.id, chatName };
  }

  // Bucățile se trimit în ordine, oprindu-se la prima eroare: nu are rost să
  // trimită partea a treia dacă a doua nu a ajuns.
  /** @param {{ token: string, chatId: number | string, text: string }} options */
  async function sendMessage({ token, chatId, text }) {
    for (const chunk of splitDigest(text))
      await callTelegramApi(
        fetchImpl,
        token,
        'sendMessage',
        { chat_id: chatId, text: chunk, parse_mode: 'HTML' },
        { post: true },
      );
  }

  return { getMe, findConnectedChat, sendMessage, classifyTelegramFailure };
}
