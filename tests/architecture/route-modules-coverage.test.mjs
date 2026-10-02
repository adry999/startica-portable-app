// §5.3 (36h): garanția reală că „fiecare cerere /api verifică profilul” — nu ajunge să fie
// adevărat doar cât timp cineva își amintește să actualizeze route-modules.mjs de fiecare
// dată când adaugă o rută nouă. Testul scanează sursa fiecărui `*.routes.mjs` din src/
// (exact fișierele înregistrate în create-branch-context.mjs) după declarații literale
// `path: '/api/...'` și verifică, pentru fiecare, că apare în STATIC_PATH_MODULE,
// OPEN_PATHS, OPEN_GET_PATHS sau DYNAMIC_RECORD_PATHS din route-modules.mjs — altfel o rută
// nouă rămâne, din greșeală, fără nicio gardă și fără ca cineva să observe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STATIC_PATH_MODULE,
  OPEN_PATHS,
  OPEN_GET_PATHS,
  DYNAMIC_RECORD_PATHS,
} from '#core/server/http/route-modules.mjs';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const LITERAL_PATH = /path:\s*'(\/api\/[^']*)'/g;

/** Toate căile `/api/*` declarate literal în vreun `*.routes.mjs` din src/. */
function collectDeclaredApiPaths() {
  const paths = new Set();
  const routeFiles = readdirSync(join(REPO_ROOT, 'src'), { withFileTypes: true, recursive: true }).filter(
    entry => entry.isFile() && entry.name.endsWith('.routes.mjs'),
  );
  for (const entry of routeFiles) {
    const absolutePath = join(entry.parentPath, entry.name);
    const text = readFileSync(absolutePath, 'utf8');
    for (const match of text.matchAll(LITERAL_PATH)) paths.add(match[1]);
  }
  return { paths, fileCount: routeFiles.length };
}

test('fiecare cale /api declarată într-un *.routes.mjs are acoperire în route-modules.mjs', () => {
  const { paths, fileCount } = collectDeclaredApiPaths();
  // Dacă scanarea nu mai găsește niciun fișier *.routes.mjs (redenumire, mutare), testul
  // trebuie să pice — altfel „trece” fără să fi verificat nimic.
  assert.ok(fileCount > 10, `prea puține fișiere *.routes.mjs găsite (${fileCount}) — verifică tiparul de scanare`);
  assert.ok(paths.size > 10, 'prea puține căi /api găsite — verifică regexul de scanare');

  const covered = path =>
    Boolean(STATIC_PATH_MODULE[path]) ||
    OPEN_PATHS.has(path) ||
    OPEN_GET_PATHS.has(path) ||
    DYNAMIC_RECORD_PATHS.has(path);

  const uncovered = [...paths].filter(path => !covered(path)).sort();
  assert.deepEqual(
    uncovered,
    [],
    `căi /api fără nicio gardă/clasificare în route-modules.mjs: ${uncovered.join(', ')}`,
  );
});

test('route-modules.mjs nu listează căi care nu mai există în nicio rută reală', () => {
  const { paths } = collectDeclaredApiPaths();
  const staleStatic = Object.keys(STATIC_PATH_MODULE).filter(path => !paths.has(path));
  const staleOpen = [...OPEN_PATHS].filter(path => !paths.has(path));
  const staleOpenGet = [...OPEN_GET_PATHS].filter(path => !paths.has(path));
  assert.deepEqual(staleStatic, [], `STATIC_PATH_MODULE are căi inexistente: ${staleStatic.join(', ')}`);
  assert.deepEqual(staleOpen, [], `OPEN_PATHS are căi inexistente: ${staleOpen.join(', ')}`);
  assert.deepEqual(staleOpenGet, [], `OPEN_GET_PATHS are căi inexistente: ${staleOpenGet.join(', ')}`);
});
