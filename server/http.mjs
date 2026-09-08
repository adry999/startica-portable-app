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
export const STATIC_FILES = {
  '/': 'Startica_aplicatie_simpla.html',
  '/index.html': 'Startica_aplicatie_simpla.html',
  '/startica_app.js': 'startica_app.js',
  '/domain.mjs': 'domain.mjs',
  '/review-center.mjs': 'review-center.mjs',
  '/payment-matching.mjs': 'payment-matching.mjs',
  '/excel.mjs': 'excel.mjs',
  '/xlsx.full.min.js': 'xlsx.full.min.js',
  '/app.css': 'app.css',
  '/assets/startica-logo.svg': 'assets/startica-logo.svg',
  '/assets/startica-icon.svg': 'assets/startica-icon.svg',
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

// Modulele interfeței, servite după nume, nu după cale: tiparul nu permite
// punct sau bară, deci nu există traversare de directoare.
const MODULE_PATH = /^\/ui\/[a-z0-9-]+\.mjs$/;
export const isModule = path => MODULE_PATH.test(path);
export function sendModule(res, root, path) {
  return send(res, readFileSync(join(root, path)), 200, 'text/javascript; charset=utf-8');
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
