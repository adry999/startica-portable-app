/** @param {string[]} scriptHashes */
const contentSecurityPolicy = scriptHashes =>
  `default-src 'self'; script-src ${["'self'", ...scriptHashes.map(hash => `'sha256-${hash}'`)].join(' ')}; ` +
  "style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; " +
  "frame-ancestors 'none'";

/**
 * @param {import('node:http').ServerResponse} response
 * @param {unknown} value
 * @param {number} [status]
 * @param {string} [mime]
 * @param {string[]} [scriptHashes] hash-urile scripturilor inline permise pe această pagină
 */
export function sendResponse(
  response,
  value,
  status = 200,
  mime = 'application/json; charset=utf-8',
  scriptHashes = [],
) {
  const content = Buffer.isBuffer(value)
    ? value
    : Buffer.from(mime.startsWith('application/json') ? JSON.stringify(value) : String(value));
  response.writeHead(status, {
    'Content-Type': mime,
    'Content-Length': content.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': contentSecurityPolicy(scriptHashes),
  });
  response.end(content);
}
