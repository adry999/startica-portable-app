// Migrare PROMPT-9 §8 (02.10) — cursul BNM și planurile presetate se mută din setările
// fiecărei filiale în baza comună (vezi docs/design/RASPUNSURI-02-10.md #3: „se mută în baza
// comună. Migrare separată: sursa de adevăr = filiala cu cele mai multe zile de curs;
// divergențele celorlalte se raportează (dry-run), nu se șterg tăcut.”).
//
// Cum funcționează (spre deosebire de b1/b3-pool-expenses-to-payments.mjs/normalize-phones.mjs,
// care citesc totul prin HTTP): după mutarea codului (create-branch-context.mjs), GET
// /api/exchange-rates și GET /api/plan-presets citesc DOAR baza comună — istoricul vechi, per
// filială, nu mai are nicio cale HTTP de citire (rutele vechi au fost mutate, nu adăugate).
// Citirea istoricului vechi al fiecărei filiale se face deci direct din fișierul ei SQLite,
// read-only (openDatabaseReadOnly — exact funcția pe care branches.routes.mjs/branch-layout.mjs
// o folosesc deja pentru „N copii · N grupe” ale unei filiale neactive, deci nu e un precedent
// nou). SCRIEREA rămâne prin HTTP, împotriva serverului pornit: POST /api/exchange-rates/import
// (nou, păstrează provenența bnm/manual) și POST /api/plan-presets (existent, înlocuire
// completă).
//
// Siguranță:
//   - Dry-run implicit: doar citește (read-only) și raportează, nicio scriere.
//   - --execute: ia întâi un backup complet (POST /api/backup, ca b1/b3), apoi scrie.
//   - Niciodată nu șterge sau suprascrie istoricul unei filiale vechi — rămâne pe loc,
//     orfan, dar intact, pentru audit ulterior.
//   - Importul cursului (POST /api/exchange-rates/import) nu suprascrie o zi deja prezentă
//     în baza comună (o corectare manuală făcută după mutarea codului câștigă).
//   - Planurile presetate (POST /api/plan-presets, înlocuire completă): dacă baza comună are
//     deja presetări diferite de ale sursei, scriptul NU le suprascrie — raportează conflictul.
//   - Idempotent: rulat de două ori cu --execute, a doua rulare produce exact aceeași stare.
//
// NICIODATĂ împotriva datelor reale fără backup. Testat în această sesiune EXCLUSIV cu
// startTestApplication, pe directoare temporare de unică folosință — niciodată cu --execute
// împotriva Startica_Date/Comun/ reale de la rădăcina reposului (vezi regula din prompt).
//
// Rulare:
//   node scripts/migrate/exchange-rates-plan-presets-to-common.mjs --home "<STARTICA_HOME>"
//   node scripts/migrate/exchange-rates-plan-presets-to-common.mjs --home "<...>" --dry-run
//   node scripts/migrate/exchange-rates-plan-presets-to-common.mjs --home "<...>" --execute
//
// --home implicit: STARTICA_HOME din mediu (aceeași variabilă pe care o citește lansatorul —
// vezi src/config/environment.mjs). Fără el, scriptul nu știe unde sunt folderele filialelor.
import { randomUUID } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openDatabaseReadOnly } from '../../src/core/server/database/sqlite-connection.mjs';
import { createBranchRegistryStore } from '../../src/core/server/branches/branch-registry.mjs';
import { branchDirectories } from '../../src/core/server/branches/branch-layout.mjs';
import { dataLayout, BRANCH_REGISTRY_FILE_NAME } from '../../src/config/environment.mjs';
import { clampExchangeRates, clampExchangeRateSources } from '../../src/shared/domain/exchange-rates.mjs';

const DEFAULT_BASE_URL = process.env.STARTICA_BASE_URL || 'http://127.0.0.1:8765';

async function getJson(baseUrl, path) {
  const res = await fetch(`${baseUrl}${path}`);
  const body = await res.json();
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${body.error || JSON.stringify(body)}`);
  return body;
}

async function postJson(baseUrl, path, body, token) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Startica-Token': token },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${json.error || JSON.stringify(json)}`);
  return json;
}

function safeParse(json) {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function safeParsePresets(json) {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Citire read-only a istoricului vechi al unei filiale, direct din fișierul ei SQLite —
 * nicio cale HTTP nu-l mai expune după mutarea codului (vezi comentariul din capul fișierului).
 * @param {string} dataDir
 */
export function readBranchLegacyData(dataDir) {
  const opened = openDatabaseReadOnly({ dataDir });
  if (!opened) return { rates: {}, sources: {}, presets: [] };
  try {
    const row = key =>
      /** @type {{ value: string } | undefined} */ (
        opened.db.prepare('SELECT value FROM settings WHERE key=?').get(key)
      )?.value;
    return {
      rates: clampExchangeRates(safeParse(row('exchangeRates'))),
      sources: clampExchangeRateSources(safeParse(row('exchangeRateSources'))),
      presets: safeParsePresets(row('planPresets')),
    };
  } finally {
    opened.db.close();
  }
}

/**
 * Sursa de adevăr (RASPUNSURI-02-10.md #3): filiala cu cele mai multe zile de curs.
 * Egalitate (documentată în INTREBARI.md — reguli de departajare, în ordine):
 *   1. filiala „veche” (folder: null — exista dinainte de funcția Filiale) câștigă;
 *   2. altfel, cea creată mai devreme (createdAt mai mic);
 *   3. altfel, id-ul mai mic alfabetic (departajare finală, deterministă).
 * @param {{ branch: { id: string, folder: string | null, createdAt: string }, data: ReturnType<typeof readBranchLegacyData> }[]} entries
 */
export function chooseSourceBranch(entries) {
  return entries.reduce((best, candidate) => {
    if (!best) return candidate;
    const bestDays = Object.keys(best.data.rates).length;
    const candidateDays = Object.keys(candidate.data.rates).length;
    if (candidateDays !== bestDays) return candidateDays > bestDays ? candidate : best;
    if (best.branch.folder === null) return best;
    if (candidate.branch.folder === null) return candidate;
    if (best.branch.createdAt !== candidate.branch.createdAt)
      return candidate.branch.createdAt < best.branch.createdAt ? candidate : best;
    return candidate.branch.id < best.branch.id ? candidate : best;
  }, null);
}

/**
 * Zilele unde o altă filială are un curs DIFERIT de cel al sursei — raportate, nu șterse.
 * @param {Record<string, number>} sourceRates
 * @param {Record<string, number>} otherRates
 */
export function divergentDates(sourceRates, otherRates) {
  const dates = [];
  for (const date of Object.keys(otherRates)) {
    if (!Object.hasOwn(sourceRates, date)) continue;
    if (Math.abs(sourceRates[date] - otherRates[date]) > 1e-9) {
      dates.push({ date, sourceRate: sourceRates[date], otherRate: otherRates[date] });
    }
  }
  return dates.sort((a, b) => a.date.localeCompare(b.date));
}

function presetsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * @param {{ home?: string, baseUrl?: string, dryRun?: boolean, log?: (line: string) => void }} [options]
 */
export async function runExchangeRatesPlanPresetsMigration({
  home,
  baseUrl = DEFAULT_BASE_URL,
  dryRun = true,
  log = console.log,
} = {}) {
  if (!home || !isAbsolute(home)) {
    throw new Error('home (cale absolută) este obligatoriu — vezi STARTICA_HOME sau --home.');
  }

  log(dryRun ? '=== DRY RUN (implicit) — nu se scrie nimic ===' : '=== EXECUTE — se scrie efectiv ===');
  log(`Rădăcină de date: ${home}`);

  const registry = createBranchRegistryStore({ file: `${home}/${BRANCH_REGISTRY_FILE_NAME}`, createId: randomUUID });
  const branches = registry.list();
  if (branches.length === 0) {
    log('Niciun registru de filiale (filiale.json) găsit — nimic de migrat.');
    return { migrated: false, reason: 'no-registry' };
  }

  const legacy = dataLayout(home);
  const entries = branches.map(branch => ({
    branch,
    data: readBranchLegacyData(branchDirectories({ home, legacy, branch }).dataDir),
  }));

  log(`\nFiliale găsite: ${entries.length}`);
  for (const entry of entries) {
    log(
      `  ${entry.branch.id} „${entry.branch.name}” (folder: ${entry.branch.folder ?? '— filiala veche'}): ` +
        `${Object.keys(entry.data.rates).length} zile de curs, ${entry.data.presets.length} planuri.`,
    );
  }

  const chosen = chooseSourceBranch(entries);
  const sourceDays = Object.keys(chosen.data.rates).length;
  log(`\nSursa de adevăr aleasă: ${chosen.branch.id} „${chosen.branch.name}” (${sourceDays} zile de curs).`);

  const others = entries.filter(entry => entry.branch.id !== chosen.branch.id);
  const divergencesByBranch = new Map();
  log('\nDivergențe de curs (zile cu valori diferite între filiale) — raportate, NU corectate automat:');
  let anyDivergence = false;
  for (const other of others) {
    const divergences = divergentDates(chosen.data.rates, other.data.rates);
    if (divergences.length === 0) continue;
    anyDivergence = true;
    divergencesByBranch.set(other.branch.id, divergences);
    log(`  ${other.branch.id} „${other.branch.name}” vs sursă:`);
    for (const { date, sourceRate, otherRate } of divergences) {
      log(`    ${date}: sursă=${sourceRate}, ${other.branch.id}=${otherRate}`);
    }
  }
  if (!anyDivergence) log('  Nicio divergență găsită.');

  log('\nPlanuri presetate:');
  const presetConflicts = [];
  for (const other of others) {
    if (other.data.presets.length === 0) continue;
    if (presetsEqual(other.data.presets, chosen.data.presets)) {
      log(`  ${other.branch.id} „${other.branch.name}”: identice cu sursa.`);
    } else {
      presetConflicts.push(other.branch.id);
      log(
        `  ${other.branch.id} „${other.branch.name}”: ${other.data.presets.length} planuri DIFERITE de ale sursei ` +
          `(${JSON.stringify(other.data.presets.map(preset => preset.id))}) — rămân neutilizate, doar sursa se mută.`,
      );
    }
  }

  if (dryRun) {
    log(
      `\nCe s-ar scrie la --execute: backup complet, apoi POST /api/exchange-rates/import cu cele ` +
        `${sourceDays} zile ale sursei (${chosen.branch.id}), apoi POST /api/plan-presets cu cele ` +
        `${chosen.data.presets.length} planuri ale sursei (doar dacă baza comună n-are deja planuri diferite).`,
    );
    log('\nDry-run — nimic scris. Rulează cu --execute (după backup) pentru migrarea reală.');
    return {
      migrated: false,
      dryRun: true,
      sourceBranchId: chosen.branch.id,
      sourceDays,
      divergencesByBranch: Object.fromEntries(divergencesByBranch),
      presetConflicts,
    };
  }

  const session = await getJson(baseUrl, '/api/session');
  const token = session.token;

  const backup = await postJson(baseUrl, '/api/backup', {}, token);
  log('\nBackup OK: ' + JSON.stringify(backup));

  let importedDays = 0;
  if (sourceDays > 0) {
    const importResult = await postJson(
      baseUrl,
      '/api/exchange-rates/import',
      { rates: chosen.data.rates, sources: chosen.data.sources },
      token,
    );
    importedDays = Object.keys(importResult.rates).length;
    log(`Curs: ${importedDays} zile acum în baza comună.`);
  } else {
    log('Curs: sursa nu are niciun istoric — nimic de importat.');
  }

  let presetsWritten = 0;
  let presetsSkipped = false;
  const currentPresets = await getJson(baseUrl, '/api/plan-presets');
  if (currentPresets.length > 0 && !presetsEqual(currentPresets, chosen.data.presets)) {
    presetsSkipped = true;
    log(
      `\nATENȚIE: baza comună are deja ${currentPresets.length} planuri, diferite de cele ale sursei — ` +
        'NU au fost suprascrise. Alege manual care rămân (Administrare → Planuri).',
    );
  } else if (chosen.data.presets.length > 0) {
    const presetsResult = await postJson(baseUrl, '/api/plan-presets', chosen.data.presets, token);
    presetsWritten = presetsResult.length;
    log(`Planuri: ${presetsWritten} presetări acum în baza comună.`);
  } else {
    log('Planuri: sursa nu are nicio presetare — nimic de scris.');
  }

  log('\nGata. Istoricul vechi al fiecărei filiale rămâne pe loc (orfan, neșters) pentru audit.');
  return {
    migrated: true,
    sourceBranchId: chosen.branch.id,
    importedDays,
    presetsWritten,
    presetsSkipped,
    divergencesByBranch: Object.fromEntries(divergencesByBranch),
    presetConflicts,
  };
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  const homeArgIndex = process.argv.indexOf('--home');
  const home = homeArgIndex !== -1 ? process.argv[homeArgIndex + 1] : process.env.STARTICA_HOME;
  const explicitDryRun = process.argv.includes('--dry-run');
  const explicitExecute = process.argv.includes('--execute');
  const dryRun = explicitDryRun || !explicitExecute;
  runExchangeRatesPlanPresetsMigration({ home, dryRun }).catch(e => {
    console.error('EROARE:', e.message);
    process.exitCode = 1;
  });
}
