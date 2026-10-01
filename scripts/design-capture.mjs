// Capturi design-lângă-cod, pe o copie izolată a datelor (PROMPT-CLAUDE-CODE-6.md §3) — NICIODATĂ
// pe `Startica_Date/` reală. Pentru fiecare modul din docs/design/verificare/README.md: artboard-ul
// (docs/design/<fișier>.dc.html#<id>) lângă ruta reală a aplicației, la 1440×900, compuse într-un
// singur PNG (design stânga, cod dreapta) salvat ca docs/design/verificare/<NN>-<modul>.png.
//
// Rulare: node scripts/design-capture.mjs [filtru-opțional-din-slug]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { copyDevData, startCopyServer } from './dev-data-copy.mjs';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');
const VERIFICARE_ROOT = join(DESIGN_ROOT, 'verificare');
const VIEWPORT = { width: 1440, height: 900 };

/**
 * @typedef {object} ModuleCapture
 * @property {string} doc nume fișier în docs/design/verificare/ (fără .md)
 * @property {string} name nume afișat (folosit în mesaje)
 * @property {string} route ruta reală a aplicației (relativ, începe cu /)
 * @property {string} artboardFile fișierul .dc.html (relativ la docs/design/)
 * @property {string} artboardId id-ul artboard-ului (ancoră în pagină)
 * @property {(page: import('playwright').Page) => Promise<void>} [prepare] interacțiune înainte de captură (ex. schimbă o filă fără query param)
 */

/** @type {ModuleCapture[]} */
const MODULES = [
  { doc: '08-dashboard', name: 'Dashboard', route: '/', artboardFile: 'Dashboard.dc.html', artboardId: '1a' },
  { doc: '02-copii', name: 'Copii', route: '/copii', artboardFile: 'Copii.dc.html', artboardId: '2a' },
  { doc: '05-achitari', name: 'Achitări', route: '/achitari', artboardFile: 'Achitari.dc.html', artboardId: '5a' },
  { doc: '19-prezenta', name: 'Prezența', route: '/prezenta', artboardFile: 'Prezenta.dc.html', artboardId: '18a' },
  { doc: '03-grupe', name: 'Grupe', route: '/grupe', artboardFile: 'Grupe.dc.html', artboardId: '4b' },
  {
    doc: '06-cheltuieli',
    name: 'Cheltuieli',
    route: '/cheltuieli',
    artboardFile: 'Cheltuieli.dc.html',
    artboardId: '6a',
  },
  {
    doc: '07-situatia',
    name: 'Situația plăților',
    route: '/situatia-platilor',
    artboardFile: 'Situatia.dc.html',
    artboardId: '7a',
  },
  {
    doc: '10-de-notificat',
    name: 'De notificat',
    route: '/de-notificat',
    artboardFile: 'De notificat.dc.html',
    artboardId: '8a',
  },
  {
    doc: '11-de-rezolvat-taxe',
    name: 'De rezolvat — Taxe',
    route: '/taxe-si-grupe',
    artboardFile: 'De rezolvat.dc.html',
    artboardId: '9a',
  },
  {
    doc: '11-de-rezolvat-verificat',
    name: 'De rezolvat — Verificat',
    route: '/de-verificat',
    artboardFile: 'De rezolvat.dc.html',
    artboardId: '9b',
  },
  {
    doc: '11-de-rezolvat-asociere',
    name: 'De rezolvat — Asociere',
    route: '/asociere-achitari',
    artboardFile: 'De rezolvat.dc.html',
    artboardId: '9c',
  },
  { doc: '04-vizite', name: 'Vizite', route: '/vizite', artboardFile: 'Vizite.dc.html', artboardId: '4a' },
  {
    doc: '24-personal-salarii',
    name: 'Personal — Salarii',
    route: '/personal?tab=salarii',
    artboardFile: 'Personal.dc.html',
    artboardId: '23c',
  },
  {
    doc: '24-personal-echipa',
    name: 'Personal — Echipa',
    route: '/personal?tab=echipa',
    artboardFile: 'Personal.dc.html',
    artboardId: '23a',
  },
  { doc: '23-bazin', name: 'Bazin', route: '/bazin', artboardFile: 'Bazin.dc.html', artboardId: '22a' },
  {
    doc: '20-raport-contabil',
    name: 'Raport contabil',
    route: '/raport',
    artboardFile: 'Raport contabil.dc.html',
    artboardId: '19a',
  },
  {
    doc: '14-sms-notificari',
    name: 'Mesaje SMS și Notificări',
    route: '/notificari',
    artboardFile: 'Sms.dc.html',
    artboardId: '11a',
    // Fila „Mesaje SMS” nu are query param (doar stare persistată local, goală într-un
    // context Playwright nou) — clic explicit, ca la Personal (acolo ?tab= e suficient).
    prepare: async page => {
      await page.getByText('Mesaje SMS', { exact: true }).click();
    },
  },
  {
    doc: '12-administrare',
    name: 'Administrare',
    route: '/backup-si-setari',
    artboardFile: 'Administrare.dc.html',
    artboardId: '10c',
  },
];

/** @param {string} file @param {string} id */
async function captureArtboard(browser, file, id) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  const url = pathToFileURL(join(DESIGN_ROOT, file)).href + '#' + id;
  await page.goto(url);
  const element = page.locator(`[id="${id}"]`);
  await element.waitFor({ state: 'visible', timeout: 5000 });
  const buffer = await element.screenshot();
  await page.close();
  return buffer;
}

/** @param {string} baseUrl @param {string} route @param {ModuleCapture['prepare']} [prepare] */
async function captureApp(browser, baseUrl, route, prepare) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(baseUrl + route, { waitUntil: 'networkidle' });
  if (prepare) await prepare(page);
  await page.waitForTimeout(300); // tranziții CSS (motion-base ~160ms) înainte de captură
  const buffer = await page.screenshot();
  await page.close();
  return buffer;
}

/** Compune două capturi în stânga/dreapta, într-un singur PNG. */
async function composeSideBySide(browser, left, right) {
  const page = await browser.newPage();
  const leftB64 = left.toString('base64');
  const rightB64 = right.toString('base64');
  await page.setContent(`<!doctype html>
    <html><body style="margin:0;background:#fff;display:flex;align-items:flex-start;">
      <img src="data:image/png;base64,${leftB64}" style="display:block;" />
      <div style="width:2px;background:#e33;flex-shrink:0;"></div>
      <img src="data:image/png;base64,${rightB64}" style="display:block;" />
    </body></html>`);
  const buffer = await page.screenshot({ fullPage: true });
  await page.close();
  return buffer;
}

async function main() {
  const filter = process.argv[2];
  const modules = filter ? MODULES.filter(m => m.doc.includes(filter)) : MODULES;
  if (modules.length === 0) throw new Error(`Niciun modul nu corespunde filtrului „${filter}”.`);

  mkdirSync(VERIFICARE_ROOT, { recursive: true });

  // Backend-ul servește `webapp/dist` (prebuilt, src/core/server/http/static-assets.mjs), nu sursa
  // live — fără acest build, capturile arată codul de la ultimul `npm run build`, nu codul curent
  // (incident constatat 01.10, vezi INTREBARI.md).
  console.log('[design-capture] construiesc webapp/dist cu codul curent…');
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
    cwd: join(REPO_ROOT, 'webapp'),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  console.log('[design-capture] pregătesc copia izolată de date…');
  const copyRoot = copyDevData();
  const { child: server, port } = await startCopyServer(copyRoot);
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[design-capture] server pe copie: ${baseUrl}`);

  const browser = await chromium.launch();
  try {
    for (const module of modules) {
      console.log(`[design-capture] ${module.doc} — ${module.name}`);
      const [left, right] = await Promise.all([
        captureArtboard(browser, module.artboardFile, module.artboardId),
        captureApp(browser, baseUrl, module.route, module.prepare),
      ]);
      const composed = await composeSideBySide(browser, left, right);
      const outFile = join(VERIFICARE_ROOT, `${module.doc}.png`);
      writeFileSync(outFile, composed);
      console.log(`[design-capture]   → ${outFile}`);
    }
  } finally {
    await browser.close();
    server.kill();
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) await main();
