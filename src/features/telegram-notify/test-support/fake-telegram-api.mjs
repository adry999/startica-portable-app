// Fetch fals pentru Bot API: răspunsuri configurabile pentru getMe/getUpdates/sendMessage
// și un jurnal al apelurilor, ca testele să verifice chat_id/text/parse_mode și ordinea bucăților.

function jsonResponse(status, body) {
  return {
    status,
    json: async () => body,
  };
}

/**
 * @param {{
 *   getMe?: { status?: number, body?: unknown } | (() => { status?: number, body?: unknown }),
 *   getUpdates?: { status?: number, body?: unknown } | (() => { status?: number, body?: unknown }),
 *   sendMessage?: { status?: number, body?: unknown } | (() => { status?: number, body?: unknown }) | Array<{ status?: number, body?: unknown }>,
 * }} [responses]
 */
export function createFakeTelegramApi(responses = {}) {
  /** @type {Array<{ method: string, url: string, body: unknown }>} */
  const calls = [];
  let sendMessageCallIndex = 0;

  function resolveResponse(config) {
    if (typeof config === 'function') return config();
    return config;
  }

  async function fakeFetch(url, init = {}) {
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : null;
    calls.push({ method, url: String(url), body });
    const path = new URL(String(url)).pathname;

    if (path.endsWith('/getMe')) {
      const { status = 200, body: responseBody = { ok: true, result: { username: 'startica_bot' } } } =
        resolveResponse(responses.getMe) || {};
      return jsonResponse(status, responseBody);
    }
    if (path.endsWith('/getUpdates')) {
      const { status = 200, body: responseBody = { ok: true, result: [] } } =
        resolveResponse(responses.getUpdates) || {};
      return jsonResponse(status, responseBody);
    }
    if (path.endsWith('/sendMessage')) {
      const configured = responses.sendMessage;
      const config = Array.isArray(configured)
        ? configured[Math.min(sendMessageCallIndex, configured.length - 1)]
        : configured;
      sendMessageCallIndex += 1;
      const { status = 200, body: responseBody = { ok: true, result: {} } } = resolveResponse(config) || {};
      return jsonResponse(status, responseBody);
    }
    throw new Error(`Cale Bot API neașteptată în test: ${path}`);
  }

  return { fetch: /** @type {any} */ (fakeFetch), calls };
}

// Ajutoare pentru cazurile de eșec din §6, gata de folosit în teste.
export const TELEGRAM_RESPONSES = {
  unauthorized: { status: 401, body: { ok: false, error_code: 401, description: 'Unauthorized' } },
  chatNotFound: { status: 400, body: { ok: false, error_code: 400, description: 'Bad Request: chat not found' } },
  blockedByUser: {
    status: 403,
    body: { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' },
  },
  serverError: { status: 502, body: { ok: false, error_code: 502, description: 'Bad Gateway' } },
  tooManyRequests: {
    status: 429,
    body: { ok: false, error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 1 } },
  },
  webhookConflict: {
    status: 409,
    body: { ok: false, error_code: 409, description: "Conflict: can't use getUpdates method while webhook is active" },
  },
  refused: { status: 400, body: { ok: false, error_code: 400, description: 'Message is too long' } },
  emptyUpdates: { status: 200, body: { ok: true, result: [] } },
};

/**
 * @param {{ chatId?: number, firstName?: string, lastName?: string, type?: string }} [options]
 */
export function privateChatUpdate({ chatId = 111, firstName = 'Maria', lastName = '', type = 'private' } = {}) {
  return { update_id: 1, message: { chat: { id: chatId, type, first_name: firstName, last_name: lastName } } };
}

/** @param {{ chatId?: number, title?: string }} [options] */
export function groupChatUpdate({ chatId = -222, title = 'Grup' } = {}) {
  return { update_id: 2, message: { chat: { id: chatId, type: 'group', title } } };
}
