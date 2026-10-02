// Migrare PROMPT-9 §9 (02.10, după §8) — plățile pe taxă EUR fără `fxRate`/`amountEur` (scrise
// înainte ca formularul de plată să le calculeze — vezi F9 din FEEDBACK-01-10.md) primesc cursul
// BNM al zilei plății, din istoricul comun de curs (mutat în baza comună la §8).
//
// Ce înseamnă „plată pe taxă EUR": copilul avea, la LUNA plății (`payment.date.slice(0, 7)`),
// o intrare în `feeHistory` cu `currency: 'EUR'` — exact `feeEntryFor(child, month)` din
// `tuition-obligation.mjs`, aceeași funcție pe care o folosește `PaymentFormDrawer.tsx` la
// salvare (`isEurChild = feeEntryFor(selectedChild, paymentMonth)?.currency === 'EUR'`).
//
// Formula e identică cu cea de la salvare (`PaymentFormDrawer.handleSubmit`, linia cu
// `amountEur: convertAmount(totalAmount, 'MDL', 'EUR', effectiveRate!)`):
//   - `amount` al plății (lei, deja suma tenders-urilor — vezi `record-schema.mjs`) rămâne
//     NESCHIMBAT; doar se adaugă `fxRate`/`fxRateSource`/`amountEur`.
//   - cursul = `eurToMdlRate(rates, payment.date)` (exchange-rates.mjs): ziua exactă, sau — dacă
//     lipsește (weekend/sărbătoare) — cea mai recentă zi anterioară cunoscută. NICIODATĂ o zi
//     ulterioară plății. Aceeași regulă ca la formular, ca la `obligation()`.
//   - `amountEur = convertAmount(amount, 'MDL', 'EUR', cursul rezolvat)`.
//   - `fxRateSource`: provenența înregistrată pentru ZIUA CURSULUI REZOLVAT (poate fi anterioară
//     datei plății, vezi mai sus), din `exchangeRateSources`; dacă ziua n-are provenență
//     înregistrată (curs vechi, scris înainte de acest câmp, sau adus de fetch-ul de la pornire —
//     vezi comentariul din `exchange-rates.mjs`), presupunem `'bnm'` — adică exact descrierea din
//     PROMPT-9 §9 („primesc cursul BNM al zilei”); decizia e în `docs/design/INTREBARI.md` §9.
//
// Ce NU intră în scope-ul acestui script (vezi `docs/design/INTREBARI.md` §9):
//   - O plată care are deja ORICE valoare pe `fxRate` SAU `amountEur` — rămâne neatinsă, chiar
//     dacă valoarea pare greșită; corectarea unei valori existente e o decizie manuală, nu a
//     acestei migrări (regula sesiunii: „niciodată nu suprascrie tăcut ce există deja").
//   - O plată cu `currency === 'EUR'` — acolo `amount` e deja suma în euro (import vechi, altă
//     formă de date), nu lei de convertit; a-i aplica aceeași formulă ar da un rezultat greșit.
//   - O plată al cărei `childId` nu mai există în fișă (copil șters) — nu putem ști dacă taxa
//     lui era EUR la acea lună, deci nu intră la „aplicabile", nici la „nerezolvate".
//   - O plată aplicabilă dar fără NICIUN curs cunoscut în istoric la data ei sau mai devreme —
//     raportată separat, ca „nerezolvată" (nu oprește scriptul, nu aruncă).
//
// Siguranță (ca exchange-rates-plan-presets-to-common.mjs/normalize-phones.mjs):
//   - Dry-run implicit: doar citește prin HTTP și raportează, nicio scriere.
//   - --execute: backup complet (POST /api/backup) întâi, apoi scrie.
//   - Idempotent: o plată deja completată (de rularea curentă sau de alta) e săltată tăcut —
//     verificare directă înainte de fiecare scriere, nu doar pe baza raportului inițial.
//   - Multi-filială: ca normalize-phones.mjs, trece prin fiecare filială din `/api/session`
//     (`POST /api/branches/select` + token reîmprospătat), fiindcă plățile (ca și copiii) sunt
//     per-filială — spre deosebire de istoricul de curs, mutat în baza comună la §8.
//
// NICIODATĂ împotriva datelor reale fără backup. Testat în această sesiune EXCLUSIV cu
// startTestApplication, pe directoare temporare de unică folosință.
//
// Rulare:
//   node scripts/migrate/fxrate-backfill.mjs --home "<STARTICA_HOME>"               # dry-run (implicit)
//   node scripts/migrate/fxrate-backfill.mjs --home "<STARTICA_HOME>" --dry-run     # dry-run explicit
//   node scripts/migrate/fxrate-backfill.mjs --home "<STARTICA_HOME>" --execute     # scrie efectiv
//
// --home implicit: STARTICA_HOME din mediu. Scriptul nu citește nimic direct din `home` (totul
// trece prin HTTP, ca normalize-phones.mjs) — parametrul rămâne obligatoriu ca plasă de siguranță
// explicită (aceeași convenție ca exchange-rates-plan-presets-to-common.mjs), ca să nu ruleze
// cineva din greșeală fără să indice clar pe ce instalare crede că lucrează.
import { randomUUID } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { feeEntryFor } from '../../src/shared/domain/tuition-obligation.mjs';
import { eurToMdlRate, convertAmount } from '../../src/shared/domain/exchange-rates.mjs';

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

/**
 * Ziua care dă efectiv cursul folosit — ziua exactă a plății, sau cea mai recentă zi anterioară
 * cunoscută (aceeași regulă ca `eurToMdlRate`, de care are nevoie și pentru valoarea cursului;
 * dublată aici doar ca să afle și DATA rezolvată, necesară pentru `fxRateSource[dată]`).
 * @param {import('../../src/shared/domain/exchange-rates.mjs').ExchangeRates} rates
 * @param {string} date
 * @returns {string | undefined}
 */
function resolvedRateDate(rates, date) {
  if (Object.hasOwn(rates, date)) return date;
  const earlierDates = Object.keys(rates)
    .filter(known => known <= date)
    .sort();
  return earlierDates.at(-1);
}

/** Numele folosit în raport — copilul curent dacă există, altfel ce a mai rămas pe plată. */
function childLabelFor(payment, child) {
  return child?.name || payment.childName || payment.childId || '(copil necunoscut)';
}

/**
 * Evaluează o singură plată: dacă intră în scope și, dacă da, ce s-ar scrie.
 * Funcție pură — nu atinge rețeaua, folosită identic de raportul dry-run și de pasul de scriere.
 * @param {any} payment
 * @param {any[]} children
 * @param {import('../../src/shared/domain/exchange-rates.mjs').ExchangeRates} rates
 * @param {import('../../src/shared/domain/exchange-rates.mjs').ExchangeRateSources} sources
 */
export function evaluatePayment(payment, children, rates, sources) {
  if (payment.fxRate !== undefined || payment.amountEur !== undefined) {
    return { applicable: false, reason: 'are deja fxRate/amountEur' };
  }
  if (payment.currency === 'EUR') {
    return { applicable: false, reason: 'suma e deja înregistrată în EUR (altă formă de date, nu intră în §9)' };
  }
  const child = children.find(c => c.id === payment.childId);
  if (!child) return { applicable: false, reason: 'copilul nu mai există' };
  const month = payment.date.slice(0, 7);
  const feeEntry = feeEntryFor(child, month);
  if (feeEntry?.currency !== 'EUR') return { applicable: false, reason: 'taxa copilului nu era EUR la luna plății' };

  const resolvedDate = resolvedRateDate(rates, payment.date);
  if (resolvedDate === undefined) {
    return { applicable: true, resolved: false, child };
  }
  const rate = rates[resolvedDate];
  const amountEur = convertAmount(payment.amount, 'MDL', 'EUR', rate);
  // Vezi comentariul din capul fișierului: o zi fără provenență înregistrată presupune 'bnm'.
  const fxRateSource = sources[resolvedDate] ?? 'bnm';
  return { applicable: true, resolved: true, child, resolvedDate, rate, fxRateSource, amountEur };
}

/**
 * @param {{ home?: string, baseUrl?: string, dryRun?: boolean, log?: (line: string) => void }} [options]
 */
export async function runFxRateBackfillMigration({
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

  let token = (await getJson(baseUrl, '/api/session')).token;
  const { branches } = await getJson(baseUrl, '/api/session');

  const { rates, sources } = await getJson(baseUrl, '/api/exchange-rates');
  log(`\nIstoric comun de curs: ${Object.keys(rates).length} zile cunoscute.`);

  // { branchId, branchName, payment, ...evaluatePayment(...) } — doar cele aplicabile.
  const findings = [];
  let scanned = 0;

  for (const branch of branches) {
    await postJson(baseUrl, '/api/branches/select', { id: branch.id }, token);
    token = (await getJson(baseUrl, '/api/session')).token;
    const { state } = await getJson(baseUrl, '/api/state');
    for (const payment of state.payments) {
      scanned += 1;
      const outcome = evaluatePayment(payment, state.children, rates, sources);
      if (!outcome.applicable) continue;
      findings.push({ branchId: branch.id, branchName: branch.name, payment, ...outcome });
    }
  }

  const resolved = findings.filter(f => f.resolved);
  const unresolved = findings.filter(f => !f.resolved);

  log(`\nPlăți verificate (toate filialele): ${scanned}.`);
  log(
    `Plăți pe taxă EUR fără fxRate/amountEur: ${findings.length} ` +
      `(de completat: ${resolved.length}, nerezolvate — fără niciun curs în istoric: ${unresolved.length}).`,
  );

  if (resolved.length) {
    log('\nDe completat:');
    for (const f of resolved) {
      log(
        `  [${f.branchName}] ${f.payment.id} (${f.payment.date}, ${f.payment.amount.toFixed(2)} lei, ` +
          `${childLabelFor(f.payment, f.child)}): curs ${f.resolvedDate} = ${f.rate} (${f.fxRateSource}) → ` +
          `amountEur ${f.amountEur.toFixed(2)} €.`,
      );
    }
  }
  if (unresolved.length) {
    log('\nNerezolvate (niciun curs cunoscut la data plății sau mai devreme — verifică manual):');
    for (const f of unresolved) {
      log(
        `  [${f.branchName}] ${f.payment.id} (${f.payment.date}, ${f.payment.amount.toFixed(2)} lei, ` +
          `${childLabelFor(f.payment, f.child)}).`,
      );
    }
  }

  if (dryRun) {
    log('\nDry-run — nimic scris. Rulează cu --execute (după backup) pentru migrarea reală.');
    return {
      migrated: false,
      dryRun: true,
      scanned,
      applicable: findings.length,
      resolved: resolved.length,
      unresolved: unresolved.map(f => ({ branchId: f.branchId, paymentId: f.payment.id })),
    };
  }

  if (resolved.length === 0) {
    log('\nNimic de scris — nicio plată rezolvabilă.');
    return {
      migrated: true,
      scanned,
      applicable: findings.length,
      resolved: 0,
      written: 0,
      unresolved: unresolved.length,
    };
  }

  const backup = await postJson(baseUrl, '/api/backup', {}, token);
  log('\nBackup OK: ' + JSON.stringify(backup));

  const byBranch = new Map();
  for (const f of resolved) {
    if (!byBranch.has(f.branchId)) byBranch.set(f.branchId, []);
    byBranch.get(f.branchId).push(f);
  }

  let written = 0;
  let skippedAlreadyDone = 0;
  for (const [branchId, branchFindings] of byBranch) {
    await postJson(baseUrl, '/api/branches/select', { id: branchId }, token);
    token = (await getJson(baseUrl, '/api/session')).token;

    for (const f of branchFindings) {
      // Reverificare chiar înainte de scriere (nu doar pe baza raportului de mai sus) — idempotent
      // și împotriva unei rulări concurente care a atins deja aceeași plată.
      const { state, revision } = await getJson(baseUrl, '/api/state');
      const record = state.payments.find(p => p.id === f.payment.id);
      if (!record) {
        log(`  EROARE: ${f.payment.id} nu mai există — sar peste.`);
        continue;
      }
      if (record.fxRate !== undefined || record.amountEur !== undefined) {
        skippedAlreadyDone += 1;
        log(`  ${f.payment.id}: deja are fxRate/amountEur (rulare anterioară sau concurentă) — sar peste.`);
        continue;
      }
      const updated = { ...record, fxRate: f.rate, fxRateSource: f.fxRateSource, amountEur: f.amountEur };
      await postJson(
        baseUrl,
        '/api/record',
        { type: 'payments', mode: 'update', record: updated, revision, requestId: randomUUID() },
        token,
      );
      written += 1;
      log(`  ${f.payment.id}: scris (curs ${f.resolvedDate} = ${f.rate}, amountEur ${f.amountEur.toFixed(2)} €).`);
    }
  }

  log('\n=== Rezumat ===');
  log(`Scrise acum: ${written}${skippedAlreadyDone ? `, deja făcute (sărite): ${skippedAlreadyDone}` : ''}`);
  if (unresolved.length) log(`Rămân nerezolvate (fără curs în istoric): ${unresolved.length}.`);
  log('\nGata. Rulează din nou scriptul (dry-run) — ar trebui să mai găsească doar eventualele nerezolvate.');

  return {
    migrated: true,
    scanned,
    applicable: findings.length,
    resolved: resolved.length,
    written,
    skippedAlreadyDone,
    unresolved: unresolved.length,
  };
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  const homeArgIndex = process.argv.indexOf('--home');
  const home = homeArgIndex !== -1 ? process.argv[homeArgIndex + 1] : process.env.STARTICA_HOME;
  const explicitDryRun = process.argv.includes('--dry-run');
  const explicitExecute = process.argv.includes('--execute');
  const dryRun = explicitDryRun || !explicitExecute;
  runFxRateBackfillMigration({ home, dryRun }).catch(e => {
    console.error('EROARE:', e.message);
    process.exitCode = 1;
  });
}
