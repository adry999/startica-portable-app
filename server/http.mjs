import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail } from './util.mjs';

const MAX_BODY_BYTES = 20000000;

/** @param {string[]} scriptHashes */
const contentSecurityPolicy = scriptHashes =>
  `default-src 'self'; script-src ${["'self'", ...scriptHashes.map(hash => `'sha256-${hash}'`)].join(' ')}; ` +
  "style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; " +
  "frame-ancestors 'none'";

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
  '/assets/fonts/baloo2-latin.woff2': 'web/assets/fonts/baloo2-latin.woff2',
  '/assets/fonts/baloo2-latin-ext.woff2': 'web/assets/fonts/baloo2-latin-ext.woff2',
  '/assets/fonts/nunito-latin.woff2': 'web/assets/fonts/nunito-latin.woff2',
  '/assets/fonts/nunito-latin-ext.woff2': 'web/assets/fonts/nunito-latin-ext.woff2',
};

const mimeFor = path =>
  path.endsWith('.svg')
    ? 'image/svg+xml'
    : path.endsWith('.woff2')
      ? 'font/woff2'
      : path.endsWith('.css')
        ? 'text/css; charset=utf-8'
        : path.endsWith('.js') || path.endsWith('.mjs')
          ? 'text/javascript; charset=utf-8'
          : 'text/html; charset=utf-8';

/**
 * @param {import('node:http').ServerResponse} res
 * @param {unknown} value
 * @param {number} [status]
 * @param {string} [mime]
 * @param {string[]} [scriptHashes] hash-urile scripturilor inline permise pe această pagină
 */
export function send(res, value, status = 200, mime = 'application/json; charset=utf-8', scriptHashes = []) {
  const content = Buffer.isBuffer(value)
    ? value
    : Buffer.from(mime.startsWith('application/json') ? JSON.stringify(value) : String(value));
  res.writeHead(status, {
    'Content-Type': mime,
    'Content-Length': content.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': contentSecurityPolicy(scriptHashes),
  });
  res.end(content);
}

const INLINE_IMPORT_MAP = /<script type="importmap">([\s\S]*?)<\/script>/g;

// Import map-ul e singurul script inline permis. Hash-ul se calculează din fișierul
// servit, deci nu se poate desincroniza de conținutul lui.
/** @param {string} html */
export const importMapHashes = html =>
  [...html.matchAll(INLINE_IMPORT_MAP)].map(match => createHash('sha256').update(match[1]).digest('base64'));

export const isStatic = path => Object.hasOwn(STATIC_FILES, path);

// Modulele interfeței (web/ui) și regulile comune (shared) încă nemutate în src/.
// Tiparul nu permite punct sau bară în nume, deci nu există traversare.
const LEGACY_MODULE_PATH = /^\/(ui|shared)\/[a-z0-9-]+\.mjs$/;
const PATH_SEGMENT = /^[a-z0-9-]+$/;
const MODULE_FILE_NAME = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.mjs$/;

// Din src/ ajunge la client doar codul de browser. Segmentele fără punct exclud
// traversarea; server/, config/, test-support/ și testele nu se servesc niciodată.
/** @param {string} path */
function isBrowserSourceModule(path) {
  const [leading, sourceRoot, ...directories] = path.split('/');
  const fileName = directories.pop();
  if (leading !== '' || sourceRoot !== 'src' || !fileName) return false;
  if (!MODULE_FILE_NAME.test(fileName) || fileName.endsWith('.test.mjs')) return false;
  if (!directories.every(segment => PATH_SEGMENT.test(segment))) return false;
  if (directories.includes('server') || directories.includes('test-support')) return false;
  const [area, areaSection] = directories;
  if (area === 'features')
    return directories.length === 2 ? fileName === 'index.web.mjs' : ['domain', 'web'].includes(directories[2]);
  if (area === 'app' || area === 'core') return areaSection === 'web';
  return area === 'shared';
}

/** @param {string} path */
export const isModule = path => LEGACY_MODULE_PATH.test(path) || isBrowserSourceModule(path);

export function sendModule(res, root, path) {
  // /ui/... trăiește sub web/; /shared/... și /src/... sunt la rădăcină.
  const file = path.startsWith('/ui/') ? join(root, 'web', path) : join(root, path);
  if (!existsSync(file)) fail('Pagina nu există.', 404);
  return send(res, readFileSync(file), 200, 'text/javascript; charset=utf-8');
}

export function sendStatic(res, root, path) {
  const content = readFileSync(join(root, STATIC_FILES[path]));
  const mime = mimeFor(path);
  const scriptHashes = mime.startsWith('text/html') ? importMapHashes(content.toString('utf8')) : [];
  return send(res, content, 200, mime, scriptHashes);
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
