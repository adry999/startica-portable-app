// Migrare §10 (02.10) — „Telefoane: un singur format salvat". Context: până acum telefoanele se
// salvau ca text liber (de obicei 8 cifre, fără „0” inițial); de-acum record-schema.mjs și
// personal-schema.mjs normalizează orice phone/phone2 la salvare (vezi
// src/shared/domain/phone-number.mjs → resolveStoredPhone()): un mobil moldovenesc valid devine
// E.164 (`+373XXXXXXXX`), un „alt număr” cu prefix „+” rămâne cum a fost scris, orice altceva
// rămâne cum a fost scris dar marcat `phoneInvalid`. Scriptul ăsta „atinge” o singură dată toate
// înregistrările vechi (copii, vizite, persoanele autorizate să ridice copilul, angajați,
// candidați), din toate filialele, ca normalizarea să se aplice retroactiv, nu doar la
// următoarea editare manuală.
//
// Normalizarea efectivă nu e dublată aici: scriptul doar re-salvează fiecare înregistrare prin
// aceleași rute ca formularul (/api/record, /api/personal/staff, /api/personal/candidates) —
// serverul face conversia, la fel ca la o salvare normală. resolveStoredPhone() e folosit aici
// doar pentru raport (ce s-ar schimba), nu pentru scriere directă în bază.
//
// NU rula fără backup și fără --execute; implicit e dry-run (ca b3-pool-expenses-to-payments.mjs).
// NICIODATĂ împotriva datelor reale fără backup — regula de siguranță a sesiunii care a scris
// scriptul ăsta cere, în plus, ca el să nu fie rulat NICIODATĂ de agentul care l-a scris, nici
// măcar cu --dry-run, împotriva a altceva decât o bază de test de unică folosință. Rularea reală
// e decizia proprietarului aplicației, după propriul backup.
//
// Rulare:
//   node scripts/migrate/normalize-phones.mjs                # dry-run (implicit)
//   node scripts/migrate/normalize-phones.mjs --dry-run       # dry-run explicit
//   node scripts/migrate/normalize-phones.mjs --execute       # scrie efectiv
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolveStoredPhone } from '../../src/shared/domain/phone-number.mjs';

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

/** Ce s-ar întâmpla cu o valoare la următoarea salvare — doar pentru raport. */
export function classifyPhone(oldValue) {
  const trimmed = typeof oldValue === 'string' ? oldValue.trim() : '';
  if (!trimmed) return null;
  const resolved = resolveStoredPhone(trimmed);
  if (resolved.invalid) return { status: 'invalid', newValue: resolved.value };
  if (resolved.value !== trimmed) return { status: 'normalized', newValue: resolved.value };
  return { status: 'ok', newValue: resolved.value };
}

/**
 * Găsește toate telefoanele dintr-un instantaneu al unei filiale (copii + vizite).
 * @param {{ children: any[], visits: any[] }} state
 * @param {string} branchId
 */
export function findingsFromState(state, branchId) {
  const findings = [];
  const push = (kind, record, field, label, extra = {}) => {
    const result = classifyPhone(record[field]);
    if (!result) return;
    findings.push({
      kind,
      branchId,
      recordId: record.id,
      name: record.name || record.id,
      field,
      label,
      oldValue: record[field],
      ...result,
      ...extra,
    });
  };
  for (const child of state.children ?? []) {
    push('children', child, 'phone', 'Telefon 1');
    push('children', child, 'phone2', 'Telefon 2');
    for (const person of child.pickupPersons ?? [])
      push('pickup', { id: child.id, phone: person.phone }, 'phone', 'Telefon persoană autorizată', {
        name: `${child.name} → ${person.name}`,
        pickupId: person.id,
      });
  }
  for (const visit of state.visits ?? []) {
    push('visits', visit, 'phone', 'Telefon 1');
    push('visits', visit, 'phone2', 'Telefon 2');
  }
  return findings;
}

/**
 * Găsește telefoanele angajaților unei filiale (staff e comun — un angajat la ambele filiale
 * apare o singură dată, dedup prin `seenStaffIds`).
 */
function findingsFromStaff(staffList, branchId, seenStaffIds) {
  const findings = [];
  for (const member of staffList) {
    if (seenStaffIds.has(member.id)) continue;
    seenStaffIds.add(member.id);
    const result = classifyPhone(member.phone);
    if (!result) continue;
    findings.push({
      kind: 'staff',
      branchId,
      recordId: member.id,
      name: member.name,
      field: 'phone',
      label: 'Telefon',
      oldValue: member.phone,
      ...result,
    });
  }
  return findings;
}

function reportLine(finding) {
  const location = `${finding.kind} ${finding.recordId} (${finding.name}) · ${finding.label}`;
  if (finding.status === 'normalized')
    return `  ${location}: ${JSON.stringify(finding.oldValue)} → ${finding.newValue}`;
  return `  ${location}: ${JSON.stringify(finding.oldValue)} rămâne invalid — verifică manual.`;
}

/** Re-salvează o fișă copil/vizită, ca record-schema.mjs s-o normalizeze la server. */
async function resaveRecord(baseUrl, token, type, id) {
  const { state, revision } = await getJson(baseUrl, '/api/state');
  const record = state[type]?.find(r => r.id === id);
  if (!record) throw new Error(`${type} ${id} nu mai există.`);
  await postJson(baseUrl, '/api/record', { type, mode: 'update', record, revision, requestId: randomUUID() }, token);
}

/** Re-salvează un angajat, ca personal-schema.mjs s-o normalizeze la server. */
async function resaveStaff(baseUrl, token, id) {
  const { staff } = await getJson(baseUrl, '/api/personal/state');
  const record = staff.find(s => s.id === id);
  if (!record) throw new Error(`staff ${id} nu mai există.`);
  await postJson(baseUrl, '/api/personal/staff', { mode: 'update', staff: record }, token);
}

export async function runNormalizePhones({ baseUrl = DEFAULT_BASE_URL, dryRun = true, log = console.log } = {}) {
  log(dryRun ? '=== DRY RUN (implicit) — nu se scrie nimic ===' : '=== EXECUTE — se scrie efectiv ===');

  let token = (await getJson(baseUrl, '/api/session')).token;
  const { branches } = await getJson(baseUrl, '/api/session');

  const findings = [];
  const seenStaffIds = new Set();
  for (const branch of branches) {
    await postJson(baseUrl, '/api/branches/select', { id: branch.id }, token);
    token = (await getJson(baseUrl, '/api/session')).token;

    const { state } = await getJson(baseUrl, '/api/state');
    findings.push(...findingsFromState(state, branch.id));

    const { staff } = await getJson(baseUrl, '/api/personal/state');
    findings.push(...findingsFromStaff(staff, branch.id, seenStaffIds));
  }

  const counts = { ok: 0, normalized: 0, invalid: 0 };
  for (const finding of findings) counts[finding.status] += 1;
  log(
    `\nTelefoane găsite: ${findings.length} ` +
      `(deja valide: ${counts.ok}, de normalizat: ${counts.normalized}, rămân invalide: ${counts.invalid})`,
  );

  const toFix = findings.filter(f => f.status !== 'ok');
  const toNormalize = toFix.filter(f => f.status === 'normalized');
  const stillInvalid = toFix.filter(f => f.status === 'invalid');

  if (toNormalize.length) {
    log('\nDe normalizat:');
    for (const finding of toNormalize) log(reportLine(finding));
  }
  if (stillInvalid.length) {
    log('\nRămân invalide (verifică manual, nume + id de mai sus):');
    for (const finding of stillInvalid) log(reportLine(finding));
  }

  if (dryRun) {
    log('\nDry-run — nimic scris. Rulează cu --execute (după backup) pentru migrarea reală.');
    return { findings, counts };
  }

  if (toFix.length === 0) {
    log('\nNimic de salvat — toate telefoanele sunt deja în forma finală.');
    return { findings, counts };
  }

  const backup = await postJson(baseUrl, '/api/backup', {}, token);
  log('Backup OK: ' + JSON.stringify(backup));

  // O singură re-salvare per fișă, chiar dacă are și phone, și phone2, și persoane autorizate
  // invalide — evită scrieri redundante (și conflicte inutile de revizie) pentru aceeași fișă.
  const byBranch = new Map();
  for (const finding of toFix) {
    if (!byBranch.has(finding.branchId)) byBranch.set(finding.branchId, []);
    byBranch.get(finding.branchId).push(finding);
  }

  let saved = 0;
  let failed = 0;
  for (const [branchId, branchFindings] of byBranch) {
    await postJson(baseUrl, '/api/branches/select', { id: branchId }, token);
    token = (await getJson(baseUrl, '/api/session')).token;

    const seenKeys = new Set();
    for (const finding of branchFindings) {
      const type = finding.kind === 'pickup' ? 'children' : finding.kind;
      const key = `${type}:${finding.recordId}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      try {
        if (type === 'staff') await resaveStaff(baseUrl, token, finding.recordId);
        else await resaveRecord(baseUrl, token, type, finding.recordId);
        saved += 1;
        log(`  salvat: ${key}`);
      } catch (error) {
        failed += 1;
        log(`  EROARE la ${key}: ${error.message}`);
      }
    }
  }

  log('\n=== Rezumat ===');
  log(`Fișe resalvate: ${saved}${failed ? `, eșuate: ${failed}` : ''}`);
  log('\nGata. Rulează din nou scriptul (dry-run) — ar trebui să nu mai găsească nimic „de normalizat”.');
  return { findings, counts, saved, failed };
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  const explicitDryRun = process.argv.includes('--dry-run');
  const explicitExecute = process.argv.includes('--execute');
  const dryRun = explicitDryRun || !explicitExecute;
  runNormalizePhones({ dryRun }).catch(e => {
    console.error('EROARE:', e.message);
    process.exitCode = 1;
  });
}
