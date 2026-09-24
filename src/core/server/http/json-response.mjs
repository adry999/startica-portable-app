// Buildul Vite nu are scripturi inline (doar <script type="module" src="...">
// din același origine), deci CSP nu mai are nevoie de hash-uri per pagină.
const CONTENT_SECURITY_POLICY =
  "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; " +
  "object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

/**
 * @param {import('node:http').ServerResponse} response
 * @param {unknown} value
 * @param {number} [status]
 * @param {string} [mime]
 */
export function sendResponse(response, value, status = 200, mime = 'application/json; charset=utf-8') {
  const content = Buffer.isBuffer(value)
    ? value
    : Buffer.from(mime.startsWith('application/json') ? JSON.stringify(value) : String(value));
  response.writeHead(status, {
    'Content-Type': mime,
    'Content-Length': content.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  });
  response.end(content);
}
