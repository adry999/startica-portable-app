import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail } from '../errors/domain-error.mjs';
import { sendResponse } from './json-response.mjs';

// Singurele fișiere pe care serverul le livrează. Lista explicită înlocuiește
// orice rezolvare de cale, deci nu există traversare de directoare.
const STATIC_FILES = {
  '/': 'web/index.html',
  '/index.html': 'web/index.html',
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

const INLINE_IMPORT_MAP = /<script type="importmap">([\s\S]*?)<\/script>/g;

// Import map-ul e singurul script inline permis. Hash-ul se calculează din fișierul
// servit, deci nu se poate desincroniza de conținutul lui.
/** @param {string} html */
const importMapHashes = html =>
  [...html.matchAll(INLINE_IMPORT_MAP)].map(match => createHash('sha256').update(match[1]).digest('base64'));

export const isStaticAsset = path => Object.hasOwn(STATIC_FILES, path);

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
export const isBrowserModule = path => LEGACY_MODULE_PATH.test(path) || isBrowserSourceModule(path);

export function sendBrowserModule(response, root, path) {
  // /ui/... trăiește sub web/; /shared/... și /src/... sunt la rădăcină.
  const file = path.startsWith('/ui/') ? join(root, 'web', path) : join(root, path);
  if (!existsSync(file)) fail('Pagina nu există.', 404);
  return sendResponse(response, readFileSync(file), 200, 'text/javascript; charset=utf-8');
}

export function sendStaticAsset(response, root, path) {
  const content = readFileSync(join(root, STATIC_FILES[path]));
  const mime = mimeFor(path);
  const scriptHashes = mime.startsWith('text/html') ? importMapHashes(content.toString('utf8')) : [];
  return sendResponse(response, content, 200, mime, scriptHashes);
}
