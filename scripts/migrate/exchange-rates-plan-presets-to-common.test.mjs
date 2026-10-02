import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeSettingValue } from '#core/server/settings/settings-repository.mjs';
import { openDatabase } from '#core/server/database/sqlite-connection.mjs';
import { branchDirectories } from '#core/server/branches/branch-layout.mjs';
import { dataLayout } from '#config/environment.mjs';
import { startTestApplication, removeDirWithRetry } from '#test-support/start-test-application.mjs';
import { runExchangeRatesPlanPresetsMigration } from './exchange-rates-plan-presets-to-common.mjs';

// PROMPT-9 §8 — niciodată rulat cu --execute împotriva Startica_Date/Comun/ reale: fiecare
// test de mai jos pornește o aplicație nouă, pe un folder temporar de unică folosință.
//
// startTestApplication (spre deosebire de pornirea reală, main.mjs) dă explicit
// `dataDir`/`backupDir` proprii (nu `dataLayout(home)`) filialei „vechi” — potrivit pentru
// restul testelor, care nu ating niciodată fișierele de pe disc direct. Acest script CHIAR
// citește filiala veche direct din `<home>\Startica_Date` (ca la o instalare reală, vezi
// comentariul din capul fișierului migrat), deci testele de-aici trebuie să pornească
// aplicația cu EXACT acel aranjament — altfel `readBranchLegacyData` ar căuta în folderul
// greșit și n-ar găsi niciodată datele „vechi” scrise mai jos.
async function startAppWithRealLayout(t, options = {}) {
  const home = mkdtempSync(join(tmpdir(), 'startica-xr-migrate-'));
  // removeDirWithRetry (nu rmSync simplu): pe Windows, db.close() poate elibera fișierul cu o
  // mică întârziere — exact motivul din comentariul lui start-test-application.mjs.
  t.after(() => removeDirWithRetry(home));
  const legacy = dataLayout(home);
  const bundle = await startTestApplication(t, {
    ...options,
    home,
    dataDir: legacy.dataDir,
    backupDir: legacy.backupDir,
  });
  // `bundle.dir` e folderul auto-generat, nealiniat (vezi comentariul de mai sus) — testele
  // de-aici trebuie să folosească `home`-ul real al aplicației, nu acel folder gol.
  return { ...bundle, dir: home };
}

/** Scrie exchangeRates/exchangeRateSources/planPresets direct în baza FILIALEI ACTIVE. */
function writeLegacyExchangeData(app, { rates, sources, presets } = {}) {
  if (rates) writeSettingValue(app.db, 'exchangeRates', JSON.stringify(rates));
  if (sources) writeSettingValue(app.db, 'exchangeRateSources', JSON.stringify(sources));
  if (presets) writeSettingValue(app.db, 'planPresets', JSON.stringify(presets));
}

/** Scrie exchangeRates/exchangeRateSources/planPresets în baza unei filiale NEACTIVE. */
function writeLegacyExchangeDataForBranch(home, branch, { rates, sources, presets } = {}) {
  const legacy = dataLayout(home);
  const { dataDir, backupDir } = branchDirectories({ home, legacy, branch });
  const { db } = openDatabase({ dataDir, backupDir });
  try {
    if (rates) writeSettingValue(db, 'exchangeRates', JSON.stringify(rates));
    if (sources) writeSettingValue(db, 'exchangeRateSources', JSON.stringify(sources));
    if (presets) writeSettingValue(db, 'planPresets', JSON.stringify(presets));
  } finally {
    db.close();
  }
}

function collectLog() {
  const lines = [];
  return { log: line => lines.push(line), lines };
}

test('fără home, aruncă o eroare clară', async () => {
  await assert.rejects(() => runExchangeRatesPlanPresetsMigration({ home: undefined, log: () => {} }), /home/);
});

test('dry-run: o singură filială (veche) raportează sursa și nu scrie nimic', async t => {
  const { app, dir, origin, get } = await startAppWithRealLayout(t);
  writeLegacyExchangeData(app, {
    rates: { '2026-09-18': 19.8, '2026-09-19': 19.9 },
    sources: { '2026-09-18': 'bnm', '2026-09-19': 'bnm' },
    presets: [{ id: 'PLAN-1', name: 'Standard', priceEur: 120 }],
  });
  const branchId = (await get('/api/session')).branch.id;

  const { log, lines } = collectLog();
  const result = await runExchangeRatesPlanPresetsMigration({ home: dir, baseUrl: origin, dryRun: true, log });

  assert.equal(result.migrated, false);
  assert.equal(result.sourceBranchId, branchId);
  assert.equal(result.sourceDays, 2);
  assert.deepEqual(result.divergencesByBranch, {});
  assert.ok(lines.some(line => line.includes('Dry-run — nimic scris')));

  // Nimic scris cu adevărat în baza comună.
  assert.deepEqual(await get('/api/exchange-rates'), { rates: {}, sources: {} });
  assert.deepEqual(await get('/api/plan-presets'), []);
});

test('--execute copiază istoricul sursei în baza comună, cu provenența păstrată', async t => {
  const { app, dir, origin, get } = await startAppWithRealLayout(t);
  writeLegacyExchangeData(app, {
    rates: { '2026-09-18': 19.8, '2026-09-19': 19.9 },
    sources: { '2026-09-18': 'bnm', '2026-09-19': 'manual' },
    presets: [{ id: 'PLAN-1', name: 'Standard', priceEur: 120 }],
  });

  const { log } = collectLog();
  const result = await runExchangeRatesPlanPresetsMigration({ home: dir, baseUrl: origin, dryRun: false, log });

  assert.equal(result.migrated, true);
  assert.equal(result.importedDays, 2);
  assert.equal(result.presetsWritten, 1);
  assert.equal(result.presetsSkipped, false);

  assert.deepEqual(await get('/api/exchange-rates'), {
    rates: { '2026-09-18': 19.8, '2026-09-19': 19.9 },
    sources: { '2026-09-18': 'bnm', '2026-09-19': 'manual' },
  });
  assert.deepEqual(await get('/api/plan-presets'), [{ id: 'PLAN-1', name: 'Standard', priceEur: 120 }]);
});

test('alege ca sursă filiala cu cele mai multe zile de curs și raportează divergențele celeilalte', async t => {
  const { app, dir, origin, get, post } = await startAppWithRealLayout(t);
  // Filiala activă (veche, folder: null): 3 zile — va fi sursa.
  writeLegacyExchangeData(app, {
    rates: { '2026-09-18': 19.8, '2026-09-19': 19.9, '2026-09-20': 20.0 },
    sources: { '2026-09-18': 'bnm', '2026-09-19': 'bnm', '2026-09-20': 'bnm' },
  });
  const legacyBranchId = (await get('/api/session')).branch.id;

  // A doua filială: o singură zi, divergentă față de sursă.
  const created = await post('/api/branches', { name: 'Bazin' });
  assert.equal(created.status, 200);
  writeLegacyExchangeDataForBranch(dir, created.body.branch, {
    rates: { '2026-09-18': 21.5 }, // diferit de sursă (19.8)
    sources: { '2026-09-18': 'manual' },
  });

  const { log } = collectLog();
  const result = await runExchangeRatesPlanPresetsMigration({ home: dir, baseUrl: origin, dryRun: true, log });

  assert.equal(result.sourceBranchId, legacyBranchId);
  assert.equal(result.sourceDays, 3);
  assert.deepEqual(result.divergencesByBranch[created.body.branch.id], [
    { date: '2026-09-18', sourceRate: 19.8, otherRate: 21.5 },
  ]);
  assert.ok(log, 'log callback folosit'); // fără să rescriem tot raportul aici

  // Dry-run: nimic scris, iar istoricul filialei B rămâne pe loc, neatins.
  assert.deepEqual(await get('/api/exchange-rates'), { rates: {}, sources: {} });
});

test('--execute nu suprascrie planuri deja prezente și diferite în baza comună', async t => {
  const { app, dir, origin, get, post } = await startAppWithRealLayout(t);
  writeLegacyExchangeData(app, { presets: [{ id: 'PLAN-OLD', name: 'Vechi', priceEur: 100 }] });
  // Cineva a configurat deja planuri prin UI, direct în baza comună, după mutarea codului.
  await post('/api/plan-presets', [{ id: 'PLAN-NEW', name: 'Nou', priceEur: 200 }]);

  const { log, lines } = collectLog();
  const result = await runExchangeRatesPlanPresetsMigration({ home: dir, baseUrl: origin, dryRun: false, log });

  assert.equal(result.presetsSkipped, true);
  assert.equal(result.presetsWritten, 0);
  assert.ok(lines.some(line => line.includes('ATENȚIE')));
  assert.deepEqual(await get('/api/plan-presets'), [{ id: 'PLAN-NEW', name: 'Nou', priceEur: 200 }]);
});

test('--execute e idempotent: a doua rulare nu duplică și produce aceeași stare', async t => {
  const { app, dir, origin, get } = await startAppWithRealLayout(t);
  writeLegacyExchangeData(app, {
    rates: { '2026-09-18': 19.8, '2026-09-19': 19.9 },
    sources: { '2026-09-18': 'bnm', '2026-09-19': 'bnm' },
    presets: [{ id: 'PLAN-1', name: 'Standard', priceEur: 120 }],
  });

  await runExchangeRatesPlanPresetsMigration({ home: dir, baseUrl: origin, dryRun: false, log: () => {} });
  const firstState = await get('/api/exchange-rates');
  const firstPresets = await get('/api/plan-presets');

  const second = await runExchangeRatesPlanPresetsMigration({
    home: dir,
    baseUrl: origin,
    dryRun: false,
    log: () => {},
  });

  assert.equal(second.presetsSkipped, false); // identice cu ce există deja — nu e tratat ca „diferit"
  assert.deepEqual(await get('/api/exchange-rates'), firstState);
  assert.deepEqual(await get('/api/plan-presets'), firstPresets);
});
