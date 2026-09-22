import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail } from '../errors/domain-error.mjs';
import { sendResponse } from './json-response.mjs';

// Singurele fișiere pe care serverul le livrează. Lista explicită înlocuiește
// orice rezolvare de cale, deci nu există traversare de directoare.
export const STATIC_FILES = {
  '/': 'web/index.html',
  '/index.html': 'web/index.html',
  '/styles/base.css': 'web/styles/base.css',
  '/styles/layout.css': 'web/styles/layout.css',
  '/styles/components.css': 'web/styles/components.css',
  '/styles/features/backup.css': 'web/styles/features/backup.css',
  '/styles/features/billing.css': 'web/styles/features/billing.css',
  '/styles/features/children.css': 'web/styles/features/children.css',
  '/styles/features/dashboard.css': 'web/styles/features/dashboard.css',
  '/styles/features/data-transfer.css': 'web/styles/features/data-transfer.css',
  '/styles/features/expenses.css': 'web/styles/features/expenses.css',
  '/styles/features/groups.css': 'web/styles/features/groups.css',
  '/styles/features/payments.css': 'web/styles/features/payments.css',
  '/styles/features/record-editing.css': 'web/styles/features/record-editing.css',
  '/styles/features/review-center.css': 'web/styles/features/review-center.css',
  '/styles/features/visits.css': 'web/styles/features/visits.css',
  '/styles/print.css': 'web/styles/print.css',
  '/vendor/xlsx.full.min.js': 'web/vendor/xlsx.full.min.js',
  '/assets/startica-logo.svg': 'web/assets/startica-logo.svg',
  '/assets/startica-icon.svg': 'web/assets/startica-icon.svg',
  '/assets/startica.ico': 'web/assets/startica.ico',
  '/assets/startica-192.png': 'web/assets/startica-192.png',
  '/assets/startica-512.png': 'web/assets/startica-512.png',
  '/manifest.json': 'web/manifest.json',
  '/assets/fonts/baloo2-latin.woff2': 'web/assets/fonts/baloo2-latin.woff2',
  '/assets/fonts/baloo2-latin-ext.woff2': 'web/assets/fonts/baloo2-latin-ext.woff2',
  '/assets/fonts/nunito-latin.woff2': 'web/assets/fonts/nunito-latin.woff2',
  '/assets/fonts/nunito-latin-ext.woff2': 'web/assets/fonts/nunito-latin-ext.woff2',
};

const mimeFor = path =>
  path.endsWith('.svg')
    ? 'image/svg+xml'
    : path.endsWith('.ico')
      ? 'image/x-icon'
      : path.endsWith('.png')
        ? 'image/png'
        : path.endsWith('.woff2')
          ? 'font/woff2'
          : path.endsWith('.css')
            ? 'text/css; charset=utf-8'
            : path.endsWith('.js') || path.endsWith('.mjs')
              ? 'text/javascript; charset=utf-8'
              : path === '/manifest.json'
                ? 'application/manifest+json'
                : 'text/html; charset=utf-8';

const INLINE_IMPORT_MAP = /<script type="importmap">([\s\S]*?)<\/script>/g;

// Import map-ul e singurul script inline permis. Hash-ul se calculează din fișierul
// servit, deci nu se poate desincroniza de conținutul lui.
/** @param {string} html */
const importMapHashes = html =>
  [...html.matchAll(INLINE_IMPORT_MAP)].map(match => createHash('sha256').update(match[1]).digest('base64'));

export const isStaticAsset = path => Object.hasOwn(STATIC_FILES, path);

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

export const isBrowserModule = isBrowserSourceModule;

export function sendBrowserModule(response, root, path) {
  const file = join(root, path);
  if (!existsSync(file)) fail('Pagina nu există.', 404);
  return sendResponse(response, readFileSync(file), 200, 'text/javascript; charset=utf-8');
}

export function sendStaticAsset(response, root, path) {
  const content = readFileSync(join(root, STATIC_FILES[path]));
  const mime = mimeFor(path);
  const scriptHashes = mime.startsWith('text/html') ? importMapHashes(content.toString('utf8')) : [];
  return sendResponse(response, content, 200, mime, scriptHashes);
}
