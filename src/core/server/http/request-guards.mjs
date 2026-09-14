import { fail } from '../errors/domain-error.mjs';

const MAX_BODY_BYTES = 20000000;

// Aplicația ascultă doar pe loopback, dar o pagină din alt browser tab poate
// încerca să îi trimită cereri. Verificarea Host blochează DNS rebinding;
// Origin, tokenul de sesiune și Content-Type blochează cererile inițiate din
// altă origine, inclusiv trimiterea unui formular.
/**
 * @param {import('node:http').IncomingMessage} request
 * @param {number} port
 */
export function assertAllowedRequest(request, port) {
  const origin = `http://127.0.0.1:${port}`;
  if (request.headers.host !== `127.0.0.1:${port}`) fail('Adresă nepermisă.', 403);
  if (request.headers.origin && request.headers.origin !== origin) fail('Origine nepermisă.', 403);
  return new URL(/** @type {string} */ (request.url), origin);
}

/**
 * @param {import('node:http').IncomingMessage} request
 * @param {string} sessionToken
 */
export function assertAuthorizedWrite(request, sessionToken) {
  if (
    request.headers['x-startica-token'] !== sessionToken ||
    !request.headers['content-type']?.startsWith('application/json')
  )
    fail('Reîncarcă aplicația înainte de a salva.', 403);
}

/** @param {import('node:http').IncomingMessage} request */
export async function readJsonBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) fail('Fișierul este prea mare.', 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    fail('Cererea nu este JSON valid.', 400);
  }
}
