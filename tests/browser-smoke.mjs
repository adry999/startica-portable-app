// Browser connector cannot start with this machine's Node 22.17 runtime.
// Isolated headless Chrome test; never uses the user's Chrome profile or production DB.
//
// Rescris pentru redesign-ul React (cutover 2026-09-24): serverul servește
// webapp/dist, nu mai există DOM vanilla (getElementById('primaryNav') etc.).
// Scop redus deliberat față de vechiul fișier (~970 linii, sute de verificări
// fine pe id-uri/clase vanilla): regulile de business ale fiecărui ecran au
// deja teste Vitest+RTL în webapp/src/features/**; acest fișier verifică doar
// ce RTL (jsdom) nu poate — layout real în Chrome, overflow la lățimi reale,
// navigare reală prin URL, o mutație prin HTTP real văzută în UI după reload,
// și o cădere+recuperare de rețea reală (interceptare Fetch pe /api/*).
//
// Precondiție: webapp/dist trebuie construit (`cd webapp && npm run build`)
// înainte de a rula acest test — la fel ca înainte de cutover, nu se
// reconstruiește automat aici.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApplication } from '../startica_server.mjs';

const distIndex = new URL('../webapp/dist/index.html', import.meta.url);
if (!existsSync(distIndex))
  throw Error('webapp/dist nu este construit. Rulează "cd webapp && npm run build" înainte de acest test.');

const dir = mkdtempSync(join(tmpdir(), 'startica-browser-'));
const app = createApplication({ dataDir: join(dir, 'data'), backupDir: join(dir, 'backups'), autoBackupIntervalMs: 0 });
await new Promise(r => app.server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${app.server.address().port}`;
console.log('UI test server ready');

const session = await (await fetch(url + '/api/session')).json();
let revision = (await (await fetch(url + '/api/state')).json()).revision;

// Mutații de test prin server, nu prin pagină: modulele interne nu mai sunt
// importabile pe cale (dist e bundle-uit de Vite) — exact contractul folosit
// de testele de integrare din src/**/*.integration.test.mjs.
async function createRecord(type, record) {
  const response = await fetch(url + '/api/record', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Startica-Token': session.token },
    body: JSON.stringify({ type, mode: 'create', record, revision, requestId: randomUUID() }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, body.error);
  revision = body.revision;
  return body;
}

const executable = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (!existsSync(executable)) throw Error('Chrome not installed.');
const chrome = spawn(
  executable,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${join(dir, 'profile')}`,
    '--window-size=1440,1000',
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);
let ws,
  seq = 0;
const pending = new Map(),
  errors = [],
  consoleErrors = [];
let apiBlocked = false;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, message) {
  for (let n = 0; n < 100; n++) {
    if (await fn()) return;
    await sleep(100);
  }
  throw Error(message);
}
try {
  await until(() => existsSync(join(dir, 'profile', 'DevToolsActivePort')), 'Headless browser did not start');
  const port = readFileSync(join(dir, 'profile', 'DevToolsActivePort'), 'utf8').split('\n')[0];
  console.log('Headless Chrome ready');
  const target = await (
    await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
      method: 'PUT',
      signal: AbortSignal.timeout(5000),
    })
  ).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    const timer = setTimeout(() => j(Error('WebSocket timeout')), 5000);
    ws.onopen = () => {
      clearTimeout(timer);
      r();
    };
    ws.onerror = j;
  });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown')
      errors.push(m.params.exceptionDetails.text + ' ' + JSON.stringify(m.params.exceptionDetails.exception));
    // Verificat separat de excepții: un console.error nu oprește execuția, dar tot semnalează un bug.
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      consoleErrors.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    // Interceptare Fetch pentru simularea căderii de rețea, doar pe /api/* (vezi mai jos) —
    // orice cerere prinsă de pattern trebuie fie continuată, fie respinsă, altfel rămâne blocată.
    if (m.method === 'Fetch.requestPaused') {
      const { requestId } = m.params;
      const action = apiBlocked
        ? command('Fetch.failRequest', { requestId, errorReason: 'ConnectionRefused' })
        : command('Fetch.continueRequest', { requestId });
      action.catch(() => {});
    }
    if (m.id) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(m.error) : p.resolve(m.result);
    }
  };
  ws.onclose = e => console.error('Browser connection closed: ' + e.code + ' ' + e.reason);
  const command = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      const timer = setTimeout(() => reject(Error('Timeout: ' + method)), 5000);
      pending.set(id, {
        resolve: value => {
          clearTimeout(timer);
          resolve(value);
        },
        reject,
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async expression => {
    const r = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  await command('Runtime.enable');
  await command('Page.enable');

  const saveStatusState = () => evaluate("document.querySelector('[role=status]')?.dataset.state");
  await until(() => saveStatusState().then(s => s === 'saved'), 'Application failed to load');
  console.log('Application loaded');

  // Pictogramă netă în bara de activități Windows: ICO multi-dimensiune (16–256), nu SVG rasterizat de Chrome.
  const icoResponse = await fetch(url + '/assets/startica.ico');
  assert.equal(icoResponse.status, 200);
  assert.equal(icoResponse.headers.get('content-type'), 'image/x-icon');
  assert.equal(await evaluate("document.querySelectorAll('link[rel~=icon]').length"), 2);
  assert.equal(
    await evaluate('document.querySelector(\'link[href="/assets/startica.ico"]\')?.sizes.value'),
    '16x16 20x20 24x24 32x32 40x40 48x48 256x256',
  );

  // Versiunea afișată în sidebar trebuie să fie cea servită de /api/session, nu o valoare fixă.
  assert.equal(await evaluate("document.querySelector('aside small')?.textContent"), session.version);

  // Meniul lateral: 14 ecrane, exact unul marcat curent (Dashboard, la încărcare).
  assert.equal(await evaluate("document.querySelectorAll('aside nav button').length"), 14);
  assert.equal(await evaluate("document.querySelectorAll('aside nav button[aria-current=page]').length"), 1);
  assert.equal(
    await evaluate("document.querySelector('aside nav button[aria-current=page]')?.children[1]?.textContent"),
    'Dashboard',
  );

  const viewport = async width => {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  };
  const noPageOverflow = async () =>
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true);
  // Doar lățimi desktop: sidebar-ul (248px, fix) nu are breakpoint mobil în redesign — spre
  // deosebire de vanilla, care avea meniu hamburger sub 720px. App-ul se deschide oricum
  // maximizat într-o fereastră Chrome --app, nu la lățimi de telefon.
  for (const width of [1440, 1024]) {
    await viewport(width);
    await noPageOverflow();
  }
  await viewport(1440);

  // Navigare reală prin URL pe ecranele din checklist-ul de livrare (GHID-LIVRARE.md):
  // Dashboard, Copii, Achitări, Cheltuieli, De verificat, Backup și setări.
  const screens = [
    ['Dashboard', '/', 'Dashboard'],
    ['Copii', '/copii', 'Copii'],
    ['Achitări', '/achitari', 'Achitări'],
    ['Cheltuieli', '/cheltuieli', 'Cheltuieli'],
    ['De verificat', '/de-verificat', 'De verificat'],
    ['Backup și setări', '/backup-si-setari', 'Backup și setări'],
  ];
  for (const [navLabel, path, title] of screens) {
    await evaluate(
      `[...document.querySelectorAll('aside nav button')].find(b=>b.children[1]?.textContent===${JSON.stringify(navLabel)})?.click()`,
    );
    await until(() => evaluate('location.pathname').then(p => p === path), `Navigare la ${navLabel} a eșuat`);
    assert.equal(await evaluate("document.querySelector('header h1')?.textContent"), title);
    await noPageOverflow();
  }

  // Mutație reală prin HTTP (nu prin pagină — modulele interne nu mai sunt importabile pe cale
  // în dist-ul construit): un copil și o plată, verificate în UI după reload.
  const marker = 'Smoke ' + randomUUID().slice(0, 8);
  await createRecord('children', {
    id: 'SMOKE-CHILD',
    name: marker,
    parent: 'Părinte smoke',
    phone: '',
    status: 'Activ',
  });
  await createRecord('payments', {
    id: 'SMOKE-PAY',
    date: '2026-09-08',
    childId: 'SMOKE-CHILD',
    amount: 500,
    tenders: [{ method: 'Cash', amount: 500 }],
  });
  await evaluate('location.reload()');
  await until(() => saveStatusState().then(s => s === 'saved'), 'Reload după mutație a eșuat');
  await evaluate(
    `[...document.querySelectorAll('aside nav button')].find(b=>b.children[1]?.textContent==='Copii')?.click()`,
  );
  await until(
    () => evaluate("document.querySelector('main')?.textContent").then(t => t?.includes(marker)),
    'Copilul creat prin API nu apare pe ecranul Copii',
  );
  await evaluate(
    `[...document.querySelectorAll('aside nav button')].find(b=>b.children[1]?.textContent==='Achitări')?.click()`,
  );
  await until(
    () => evaluate("document.querySelector('main')?.textContent").then(t => t?.includes(marker)),
    'Plata creată prin API nu apare pe ecranul Achitări',
  );

  // Totul de mai sus trebuie să fi rulat fără erori — verificat aici, înainte de căderea
  // de rețea intenționată de mai jos (care produce, real, un console.error de raportare).
  assert.deepEqual(errors, [], 'Excepții necapturate în consolă');
  assert.deepEqual(consoleErrors, [], 'console.error în timpul rulării');

  // Cădere de rețea reală la reload, doar pe cererile /api/* (Network.emulateNetworkConditions
  // ar bloca și documentul HTML însuși), apoi recuperare prin butonul de reîncercare.
  await command('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] });
  apiBlocked = true;
  await command('Page.reload', { ignoreCache: true });
  await until(() => saveStatusState().then(s => s === 'error'), 'Căderea de rețea trebuie să arate roșu');
  apiBlocked = false;
  await evaluate("document.querySelector('[role=status] button')?.click()");
  await until(() => saveStatusState().then(s => s === 'saved'), 'Reîncercarea trebuie să arate verde la reconectare');
  await command('Fetch.disable');
  // errors/consoleErrors nu se re-verifică aici: căderea de rețea de mai sus a produs,
  // intenționat și real, exact un console.error de raportare (showNotice(..., true)).

  console.log('Browser smoke OK');
} finally {
  try {
    ws?.close();
  } catch {
    // ignorat: browser-ul poate fi deja închis
  }
  chrome.kill();
  await app.close();
}
