import { countSmsSegments } from '#shared/domain/sms-segments.mjs';

// Fetch fals pentru API-ul sms.md: răspunsuri configurabile per rută și un jurnal
// al apelurilor, ca testele să verifice X-Api-Token, corpul și ordinea trimiterilor.

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  };
}

function resolveResponse(config) {
  return typeof config === 'function' ? config() : config;
}

/** @param {{ text?: string, to?: string }} requestBody */
function defaultSendBody(requestBody) {
  const { characters, segments, encoding } = countSmsSegments(requestBody?.text ?? '');
  return {
    status: 'success',
    httpCode: 200,
    data: {
      id: 'msg-1',
      to: requestBody?.to,
      text: requestBody?.text,
      characters,
      segments,
      encoding,
      cost: (segments * 0.3).toFixed(2),
      currency: 'MDL',
      destination: 'moldova',
    },
  };
}

/** @param {string} id */
const defaultMessageBody = id => ({
  status: 'success',
  httpCode: 200,
  data: { id, status: { id: 3, name: 'Delivered' } },
});

const DEFAULT_BALANCE_BODY = { status: 'success', httpCode: 200, data: { balance: '100.00', currency: 'MDL' } };
const DEFAULT_SENDERS_BODY = {
  status: 'success',
  httpCode: 200,
  data: [{ name: 'Startica', status: { id: 1, name: 'Active' } }],
};

/**
 * @param {{
 *   send?: { status?: number, body?: unknown } | (() => { status?: number, body?: unknown }) | Array<{ status?: number, body?: unknown }>,
 *   message?: { status?: number, body?: unknown } | ((id: string) => { status?: number, body?: unknown }),
 *   balance?: { status?: number, body?: unknown } | (() => { status?: number, body?: unknown }),
 *   senders?: { status?: number, body?: unknown } | (() => { status?: number, body?: unknown }),
 * }} [responses]
 */
export function createFakeSmsApi(responses = {}) {
  /** @type {Array<{ method: string, url: string, headers: Record<string, string>, body: unknown }>} */
  const calls = [];
  let sendCallIndex = 0;

  async function fakeFetch(url, init = {}) {
    const method = init.method || 'GET';
    const headers = init.headers || {};
    const requestBody = init.body ? JSON.parse(String(init.body)) : null;
    calls.push({ method, url: String(url), headers, body: requestBody });
    const parsedUrl = new URL(String(url));
    if (parsedUrl.host !== 'api.sms.md') throw new Error('Cale sms.md neașteptată în test');
    const path = parsedUrl.pathname;

    if (method === 'POST' && path === '/v3/messages') {
      const configured = responses.send;
      const config = Array.isArray(configured)
        ? configured[Math.min(sendCallIndex, configured.length - 1)]
        : configured;
      sendCallIndex += 1;
      const { status = 200, body: responseBody = defaultSendBody(requestBody) } = resolveResponse(config) || {};
      return jsonResponse(status, responseBody);
    }

    const messageMatch = method === 'GET' && path.match(/^\/v3\/messages\/([^/]+)$/);
    if (messageMatch) {
      const id = messageMatch[1];
      const config = typeof responses.message === 'function' ? responses.message(id) : responses.message;
      const { status = 200, body: responseBody = defaultMessageBody(id) } = config || {};
      return jsonResponse(status, responseBody);
    }

    if (method === 'GET' && path === '/v3/account/balance') {
      const { status = 200, body: responseBody = DEFAULT_BALANCE_BODY } = resolveResponse(responses.balance) || {};
      return jsonResponse(status, responseBody);
    }

    if (method === 'GET' && path === '/v3/sender-aliases') {
      const { status = 200, body: responseBody = DEFAULT_SENDERS_BODY } = resolveResponse(responses.senders) || {};
      return jsonResponse(status, responseBody);
    }

    throw new Error(`Cale sms.md neașteptată în test: ${path}`);
  }

  return { fetch: /** @type {any} */ (fakeFetch), calls };
}

// Ajutoare pentru cazurile de eșec din §4.3, gata de folosit în teste.
export const SMS_RESPONSES = {
  unauthorized: {
    status: 401,
    body: { status: 'error', httpCode: 401, code: 'INVALID_API_TOKEN', message: 'Token invalid.' },
  },
  scopeForbidden: {
    status: 403,
    body: {
      status: 'error',
      httpCode: 403,
      code: 'SCOPE_FORBIDDEN',
      message: 'Lipsește scope-ul messages:send.',
    },
  },
  insufficientBalance: {
    status: 402,
    body: { status: 'error', httpCode: 402, code: 'INSUFFICIENT_BALANCE', message: 'Sold insuficient.' },
  },
  invalidTo: {
    status: 422,
    body: {
      status: 'error',
      httpCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Validare eșuată.',
      errors: { to: ['Invalid number'] },
    },
  },
  invalidFrom: {
    status: 422,
    body: {
      status: 'error',
      httpCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Validare eșuată.',
      errors: { from: ['Sender not approved'] },
    },
  },
  invalidText: {
    status: 422,
    body: {
      status: 'error',
      httpCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Validare eșuată.',
      errors: { text: ['Text refused'] },
    },
  },
  rateLimited: {
    status: 429,
    body: { status: 'error', httpCode: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'Prea multe cereri.' },
  },
  serverError: {
    status: 502,
    body: { status: 'error', httpCode: 502, code: 'INTERNAL_ERROR', message: 'Eroare internă.' },
  },
};
