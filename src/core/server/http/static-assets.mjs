import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fail } from '../errors/domain-error.mjs';
import { sendResponse } from './json-response.mjs';

// Aplicația React compilată (`cd webapp && npm run build`). Servite ca fișiere
// statice dintr-un singur folder, cu o rezolvare de cale explicit verificată —
// nu o listă albă de fișiere individuale, pentru că numele fișierelor din
// build (hash de conținut) se schimbă la fiecare compilare.
const DIST_ROOT = 'webapp/dist';

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
              : path.endsWith('.json')
                ? 'application/json; charset=utf-8'
                : 'text/html; charset=utf-8';

// SPA fără router propriu: un singur punct de intrare (index.html), randat
// diferit după starea din React, nu după cale. Orice cerere care nu e clar
// un fișier din build (fără extensie în ultimul segment) primește index.html.
const hasFileExtension = path => /\.[a-z0-9]+$/i.test(path.split('/').at(-1) ?? '');

/**
 * @param {string} root
 * @param {string} path cererea HTTP (începe cu „/”)
 * @returns {string | null} calea absolută a fișierului de servit, sau null dacă nu există / e în afara DIST_ROOT
 */
function resolveDistFile(root, path) {
  const distRoot = resolve(root, DIST_ROOT);
  const target = path === '/' || !hasFileExtension(path) ? join(distRoot, 'index.html') : resolve(distRoot, '.' + path);
  // Verificare de traversare: rezolvarea trebuie să rămână strict în interiorul DIST_ROOT.
  if (target !== distRoot && !target.startsWith(distRoot + sep)) return null;
  if (!existsSync(target) || !statSync(target).isFile()) return null;
  return target;
}

export const isStaticAsset = (root, path) => resolveDistFile(root, path) !== null;

export function sendStaticAsset(response, root, path) {
  const file = resolveDistFile(root, path);
  if (!file) fail('Pagina nu există.', 404);
  return sendResponse(response, readFileSync(file), 200, mimeFor(file));
}
