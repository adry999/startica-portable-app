/** @typedef {import('../sms-notify.types.mjs').SmsFailure} SmsFailure */
/** @typedef {import('../sms-notify.types.mjs').SmsService} SmsService */

export const SMS_API_ROOT = 'https://api.sms.md';
export const SMS_REQUIRED_SCOPES = ['messages:send', 'messages:read', 'account:read', 'senders:read'];
const REQUEST_TIMEOUT_MS = 15000;

const NETWORK_MESSAGE = 'Fără internet sau sms.md indisponibil.';
const TOKEN_INVALID_MESSAGE = 'Token sms.md invalid sau dezactivat. Reconectează din Notificări.';
const SCOPE_MESSAGE =
  'Tokenul nu are permisiunea necesară. Creează un token cu messages:send, messages:read, account:read, senders:read.';
const BALANCE_MESSAGE = 'Sold insuficient la sms.md. Alimentează contul și reia eșuatele.';
const SENDER_MESSAGE = 'Expeditorul nu e aprobat la sms.md.';
const INVALID_PHONE_MESSAGE = 'Număr invalid pentru sms.md.';

function isAbort(error) {
  return error?.name === 'AbortError';
}

function isFetchFailure(error) {
  return error instanceof TypeError && /fetch failed/i.test(error.message);
}

/**
 * Clasificarea eșecurilor sms.md, într-un singur loc (§4.3 din spec).
 * @param {unknown} error
 * @returns {SmsFailure}
 */
export function classifySmsFailure(error) {
  const failure = /** @type {any} */ (error);
  if (isAbort(failure)) return { kind: 'transient', scope: 'account', code: 'TIMEOUT', message: NETWORK_MESSAGE };
  if (isFetchFailure(failure))
    return { kind: 'transient', scope: 'account', code: 'NETWORK', message: NETWORK_MESSAGE };
  const status = failure?.status;
  const code = failure?.code;
  const errors = failure?.errors;
  if (code === 'RATE_LIMIT_EXCEEDED') return { kind: 'transient', scope: 'account', code, message: NETWORK_MESSAGE };
  if (code === 'INTERNAL_ERROR' || (status >= 500 && status < 600))
    return { kind: 'transient', scope: 'account', code, message: NETWORK_MESSAGE };
  if (code === 'INVALID_API_TOKEN' || code === 'AUTHENTICATION_REQUIRED')
    return { kind: 'permanent', scope: 'account', code, message: TOKEN_INVALID_MESSAGE };
  if (code === 'SCOPE_FORBIDDEN') return { kind: 'permanent', scope: 'account', code, message: SCOPE_MESSAGE };
  if (code === 'INSUFFICIENT_BALANCE') return { kind: 'permanent', scope: 'account', code, message: BALANCE_MESSAGE };
  if (errors?.from) return { kind: 'permanent', scope: 'account', code, message: SENDER_MESSAGE };
  if (errors?.to || errors?._) return { kind: 'permanent', scope: 'recipient', code, message: INVALID_PHONE_MESSAGE };
  if (errors?.text)
    return { kind: 'permanent', scope: 'recipient', code, message: `sms.md a refuzat textul: ${errors.text[0]}.` };
  return { kind: 'permanent', scope: 'recipient', code, message: `sms.md a refuzat mesajul (${code}).` };
}

/**
 * @param {typeof fetch} fetchImpl
 * @param {string} token
 * @param {string} method
 * @param {string} path
 * @param {Record<string, unknown>} [body]
 */
async function callSmsApi(fetchImpl, token, method, path, body) {
  const headers = { 'X-Api-Token': token };
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetchImpl(`${SMS_API_ROOT}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.status !== 'success') {
    const message = json?.message || `Eroare HTTP ${response.status}`;
    throw Object.assign(new Error(message), {
      status: response.status,
      code: json?.code ?? `HTTP_${response.status}`,
      errors: json?.errors,
    });
  }
  return json.data;
}

/**
 * @param {{ fetch: typeof fetch }} dependencies
 * @returns {SmsService}
 */
export function createSmsService({ fetch: fetchImpl }) {
  /** @param {{ token: string, from: string, to: string, text: string }} options */
  async function sendMessage({ token, from, to, text }) {
    return callSmsApi(fetchImpl, token, 'POST', '/v3/messages', { from, to, text });
  }

  /** @param {{ token: string, id: string }} options */
  async function getMessage({ token, id }) {
    return callSmsApi(fetchImpl, token, 'GET', `/v3/messages/${id}`);
  }

  /** @param {{ token: string }} options */
  async function getBalance({ token }) {
    return callSmsApi(fetchImpl, token, 'GET', '/v3/account/balance');
  }

  // Forma exactă a `status` per expeditor nu e în excerptul OpenAPI citit pe 2026-09-26 (obiect
  // {id,name} sau numeric): acceptăm ambele, ca primul conect real să corecteze într-un singur loc.
  /** @param {{ token: string }} options */
  async function listActiveSenders({ token }) {
    const senders = await callSmsApi(fetchImpl, token, 'GET', '/v3/sender-aliases?status=1');
    return senders.filter(alias => alias.status?.id === 1 || alias.status === 1).map(alias => alias.name);
  }

  return { sendMessage, getMessage, getBalance, listActiveSenders, classifySmsFailure };
}
