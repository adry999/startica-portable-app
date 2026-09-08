import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail } from './util.mjs';

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; connect-src 'self'; object-src 'none'; base-uri 'none'; " +
  "frame-ancestors 'none'";
const MAX_BODY_BYTES = 20000000;

// Singurele fișiere pe care serverul le livrează. Lista explicită înlocuiește
// orice rezolvare de cale, deci nu există traversare de directoare.
const STATIC_FILES = {
  '/': 'web/index.html',
  '/index.html': 'web/index.html',
  '/app.js': 'web/app.js',
  '/app.css': 'web/app.css',
  '/vendor/xlsx.full.min.js': 'web/vendor/xlsx.full.min.js',
  '/assets/startica-logo.svg': 'web/assets/startica-logo.svg',
  '/assets/startica-icon.svg': 'web/assets/startica-icon.svg',
};

const mimeFor = path =>
  path.endsWith('.svg')
    ? 'image/svg+xml'
    : path.endsWith('.css')
      ? 'text/css; charset=utf-8'
      : path.endsWith('.js') || path.endsWith('.mjs')
        ? 'text/javascript; charset=utf-8'
        : 'text/html; charset=utf-8';

export function send(res, value, status = 200, mime = 'application/json; charset=utf-8') {
  const content = Buffer.isBuffer(value)
    ? value
    : Buffer.from(mime.startsWith('application/json') ? JSON.stringify(value) : value);
  res.writeHead(status, {
    'Content-Type': mime,
    'Content-Length': content.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': CSP,
  });
  res.end(content);
}

export const isStatic = path => Object.hasOwn(STATIC_FILES, path);

// Modulele interfeței (web/ui) și regulile comune (shared), servite după nume,
// nu după cale: tiparul nu permite punct sau bară, deci nu există traversare de
// directoare. Regulile comune se servesc pentru că aceleași fișiere rulează și
// în browser, și pe server — o singură sursă de adevăr pentru validări.
const MODULE_PATH = /^\/(ui|shared)\/[a-z0-9-]+\.mjs$/;
export const isModule = path => MODULE_PATH.test(path);
export function sendModule(res, root, path) {
  // /ui/... trăiește sub web/; /shared/... este la rădăcină.
  const file = path.startsWith('/ui/') ? join(root, 'web', path) : join(root, path);
  return send(res, readFileSync(file), 200, 'text/javascript; charset=utf-8');
}

export function sendStatic(res, root, path) {
  return send(res, readFileSync(join(root, STATIC_FILES[path])), 200, mimeFor(path));
}

export async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY_BYTES) fail('Fișierul este prea mare.', 413);
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

// Aplicația ascultă doar pe loopback, dar o pagină din alt browser tab poate
// încerca să îi trimită cereri. Verificarea Host blochează DNS rebinding;
// Origin, tokenul de sesiune și Content-Type blochează cererile inițiate din
// altă origine, inclusiv trimiterea unui formular.
export function guardRequest(req, port) {
  const origin = `http://127.0.0.1:${port}`;
  if (req.headers.host !== `127.0.0.1:${port}`) fail('Adresă nepermisă.', 403);
  if (req.headers.origin && req.headers.origin !== origin) fail('Origine nepermisă.', 403);
  return new URL(req.url, origin);
}

export function guardWrite(req, token) {
  if (req.headers['x-startica-token'] !== token || !req.headers['content-type']?.startsWith('application/json'))
    fail('Reîncarcă aplicația înainte de a salva.', 403);
}
