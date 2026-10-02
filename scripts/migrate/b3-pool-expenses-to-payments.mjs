// Migrare B3 (2026-09-30) — cele 143 „cheltuieli" de bazin mutate la Achitări.
//
// Context: scripts/diagnostic/b3-pool-expenses.mjs (doar citire) a găsit 143 înregistrări
// în Cheltuieli, categoria „Bazin", 2026-06-02..2026-07-31, 113.250,00 lei total, care sunt
// de fapt încasări de la părinți pentru bazin, înregistrate greșit ca și cheltuieli ale
// grădiniței. Utilizatorul a confirmat 3 decizii — vezi docs/design/RASPUNSURI.md
// (29.09, 23:19, secțiunea „B3 — cele 143 cheltuieli de bazin") și docs/design/INTREBARI.md
// §B3:
//   1. Toate cele 143 sunt încasări reale de bazin — fără verificare manuală rând cu rând.
//   2. Metoda la migrare: Cash pentru toate (niciuna din cele 143 n-are metodă înregistrată).
//   3. Retroactiv, inclusiv iunie–iulie 2026, nu doar de-acum înainte.
//
// Pașii exacți sunt din docs/design/ALINIERE-DESIGN.md §B3, „Migrare (cu backup + Istoric,
// o singură dată)", pașii 2-3: fiecare cheltuială devine o achitare fără copil
// (childId: '', service: 'bazin', aceeași dată/sumă/metodă, sourceName = descrierea), iar
// cheltuiala se arhivează cu nota „mutată la Achitări · <id>". Apar apoi în Asociere
// achitări, unde un om le potrivește manual cu copiii (allocations rămâne [] — nu ghicim
// nicio repartizare aici).
//
// NU rula acest script fără backup și fără --execute; implicit e dry-run.
//
// Rulare:
//   node scripts/migrate/b3-pool-expenses-to-payments.mjs --home "<STARTICA_HOME>"               # dry-run (implicit)
//   node scripts/migrate/b3-pool-expenses-to-payments.mjs --home "<STARTICA_HOME>" --dry-run      # dry-run explicit
//   node scripts/migrate/b3-pool-expenses-to-payments.mjs --home "<STARTICA_HOME>" --execute      # scrie efectiv
//
// --home implicit: STARTICA_HOME din mediu — scriptul nu citește nimic direct din `home` (totul
// trece prin HTTP, ca fxrate-backfill.mjs/normalize-phones.mjs), parametrul rămâne obligatoriu ca
// plasă de siguranță explicită.
//
// Idempotent: dacă scriptul se oprește la jumătate (eroare de rețea, revision stale etc.),
// rularea următoare cu --execute sare peste cheltuielile deja arhivate de o rulare
// anterioară și peste plățile deja create (id-ul plății e determinist, derivat din id-ul
// cheltuielii sursă). AUDIT-COD-02-10-B.md #3: un conflict pe o singură cheltuială nu mai
// oprește tot lotul — raportat per-cheltuială, restul continuă.
import { randomUUID } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { comparable } from '../../src/shared/domain/expense-categories.mjs';

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

/** Aceeași potrivire ca scripts/diagnostic/b3-pool-expenses.mjs, ca lista să fie identică. */
function isPoolExpenseCandidate(expense) {
  if (expense.archived) return false;
  const categoryMatch = comparable(String(expense.category || '')) === comparable('Bazin');
  const descriptionMatch = comparable(String(expense.description || '')).includes(comparable('bazin'));
  return categoryMatch || descriptionMatch;
}

/** Id determinist pentru plata nouă, ca să fie clar auditabil din ce cheltuială provine. */
function paymentIdFor(expense) {
  const suffix = expense.id.startsWith('EXP-') ? expense.id.slice(4) : expense.id;
  return `PAY-B3-${suffix}`;
}

function appendNote(existingNotes, addition) {
  return [existingNotes, addition].filter(Boolean).join('\n');
}

/**
 * @param {{ home?: string, baseUrl?: string, dryRun?: boolean, log?: (line: string) => void }} [options]
 */
export async function runB3PoolExpensesMigration({
  home,
  baseUrl = DEFAULT_BASE_URL,
  dryRun = true,
  log = console.log,
} = {}) {
  if (!home || !isAbsolute(home)) {
    throw new Error('home (cale absolută) este obligatoriu — vezi STARTICA_HOME sau --home.');
  }

  log(dryRun ? '=== DRY RUN (implicit) — nu se scrie nimic ===' : '=== EXECUTE — se scrie efectiv ===');

  const initial = await getJson(baseUrl, '/api/state');
  const candidates = initial.state.expenses.filter(isPoolExpenseCandidate).sort((a, b) => a.date.localeCompare(b.date));

  const totalAmount = candidates.reduce((sum, e) => sum + e.amount, 0);
  log(`Candidate găsite acum: ${candidates.length}, sumă totală: ${totalAmount.toFixed(2)} lei`);

  if (candidates.length === 0) {
    log('Nimic de migrat.');
    return { migrated: 0, skipped: 0, movedAmount: 0, failed: [] };
  }

  if (dryRun) {
    log('\nCe s-ar întâmpla (nicio scriere):');
    for (const expense of candidates) {
      const newPaymentId = paymentIdFor(expense);
      log(
        `  ${expense.id} (${expense.date}, ${expense.amount.toFixed(2)} lei) → achitare nouă ${newPaymentId} ` +
          `(childId: '', service: 'bazin', method: 'Cash', sourceName: ${JSON.stringify(expense.description || '')}); ` +
          `cheltuiala se arhivează cu nota „mutată la Achitări · ${newPaymentId}".`,
      );
    }
    log(`\nTotal de mutat din Cheltuieli în Încasări: ${candidates.length} rânduri, ${totalAmount.toFixed(2)} lei.`);
    log('\nDry-run — nimic scris. Rulează cu --execute (după backup) pentru migrarea reală.');
    return { migrated: 0, skipped: 0, movedAmount: 0, failed: [] };
  }

  const session = await getJson(baseUrl, '/api/session');
  const token = session.token;

  const backup = await postJson(baseUrl, '/api/backup', {}, token);
  log('Backup OK: ' + JSON.stringify(backup));

  let migrated = 0;
  let skipped = 0;
  let movedAmount = 0;
  // AUDIT-COD-02-10-B.md #3: un conflict pe O cheltuială (ex. 409 de la o editare concurentă)
  // nu trebuie să oprească restul lotului — raportat per-cheltuială, idempotent la rerulare,
  // ca la fxrate-backfill.mjs (#7) și exchange-rates-plan-presets-to-common.mjs.
  const failed = [];

  for (const candidateRef of candidates) {
    const expenseId = candidateRef.id;
    try {
      const { state, revision } = await getJson(baseUrl, '/api/state');
      const expense = state.expenses.find(e => e.id === expenseId);
      if (!expense) {
        log(`${expenseId}: nu mai există în state.expenses — sar peste, continui cu restul.`);
        failed.push({ expenseId, message: 'nu mai există în state.expenses' });
        continue;
      }

      if (expense.archived) {
        log(`${expenseId}: deja arhivată (rulare anterioară) — sar peste.`);
        skipped += 1;
        continue;
      }

      const newPaymentId = paymentIdFor(expense);
      const alreadyHasPayment = state.payments.some(p => p.id === newPaymentId);

      let latestRevision = revision;
      let expenseForArchive = expense;

      if (alreadyHasPayment) {
        log(`${expenseId}: plata ${newPaymentId} există deja (rulare anterioară) — sar peste crearea plății.`);
      } else {
        const payment = {
          id: newPaymentId,
          date: expense.date,
          childId: '',
          service: 'bazin',
          amount: expense.amount,
          method: 'Cash',
          sourceName: expense.description || '',
          allocations: [],
        };
        const createResult = await postJson(
          baseUrl,
          '/api/record',
          { type: 'payments', mode: 'create', record: payment, revision: latestRevision, requestId: randomUUID() },
          token,
        );
        latestRevision = createResult.revision;
        expenseForArchive = createResult.state.expenses.find(e => e.id === expenseId) ?? expense;
        log(
          `${expenseId}: achitare nouă creată ${newPaymentId} (${expense.amount.toFixed(2)} lei, revision ${latestRevision}).`,
        );
      }

      const updatedExpense = {
        ...expenseForArchive,
        archived: true,
        archivedAt: new Date().toISOString(),
        notes: appendNote(expenseForArchive.notes, `mutată la Achitări · ${newPaymentId}`),
      };
      const archiveResult = await postJson(
        baseUrl,
        '/api/record',
        { type: 'expenses', mode: 'update', record: updatedExpense, revision: latestRevision, requestId: randomUUID() },
        token,
      );
      log(
        `${expenseId}: arhivată cu nota „mutată la Achitări · ${newPaymentId}" (revision ${archiveResult.revision}).`,
      );

      migrated += 1;
      movedAmount += expense.amount;
    } catch (error) {
      failed.push({ expenseId, message: error.message });
      log(`EROARE la ${expenseId}: ${error.message} — sar peste, continui cu restul.`);
    }
  }

  log('\n=== Rezumat ===');
  log(
    `Migrate acum: ${migrated}` +
      `${skipped ? `, deja făcute (sărite): ${skipped}` : ''}` +
      `${failed.length ? `, eșuate: ${failed.length}` : ''}`,
  );
  log(`Sumă mutată din Cheltuieli în Încasări (rularea curentă): ${movedAmount.toFixed(2)} lei`);
  if (failed.length)
    log('Rulează din nou scriptul (dry-run apoi --execute) pentru cheltuielile eșuate — nimic nu s-a pierdut.');
  log('\nGata. Rulează scripts/diagnostic/b3-pool-expenses.mjs — ar trebui să nu mai găsească nicio candidată.');

  return { migrated, skipped, movedAmount, failed };
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  const homeArgIndex = process.argv.indexOf('--home');
  const home = homeArgIndex !== -1 ? process.argv[homeArgIndex + 1] : process.env.STARTICA_HOME;
  const explicitDryRun = process.argv.includes('--dry-run');
  const explicitExecute = process.argv.includes('--execute');
  const dryRun = explicitDryRun || !explicitExecute;
  runB3PoolExpensesMigration({ home, dryRun }).then(
    result => {
      if (result.failed.length) process.exitCode = 1;
    },
    e => {
      console.error('EROARE:', e.message);
      process.exitCode = 1;
    },
  );
}
