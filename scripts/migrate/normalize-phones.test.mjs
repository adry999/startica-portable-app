import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { normalizePersonalRecord } from '#features/personal/index.server.mjs';
import { commonDirectories } from '#core/server/branches/branch-layout.mjs';
import { openDatabase } from '#core/server/database/sqlite-connection.mjs';
import { startTestApplication } from '#test-support/start-test-application.mjs';
import { runNormalizePhones } from './normalize-phones.mjs';

// Fișă de test de unică folosință (startTestApplication deschide un folder temporar nou la
// fiecare rulare) — niciodată date reale, vezi regula de siguranță din PROMPT-CLAUDE-CODE-8.md.
//
// §10 normalizează ACUM orice phone/phone2 chiar la salvare (record-schema.mjs/
// personal-schema.mjs) — deci o înregistrare creată prin /api/record sau /api/personal/staff
// e deja în forma finală și nu mai are ce migra. Ca să simulăm o bază „dinainte”, scriptul
// construiește înregistrarea cu normalizeRecord()/normalizePersonalRecord() (ca să aibă toate
// celelalte câmpuri valide), apoi îi rescrie telefonul înapoi la textul brut vechi și o scrie
// direct în tabela `records`, ocolind normalizarea — exact forma în care ar fi găsit-o scriptul
// într-o bază reală, nemigrată încă.

/** Scrie o înregistrare direct în baza filialei active (app.db), ocolind normalizeRecord(). */
function writeLegacyRecord(app, type, record) {
  app.db
    .prepare('INSERT INTO records VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload')
    .run(type, record.id, JSON.stringify(record));
}

/** Scrie un angajat direct în baza comună (staff e „comun”, nu per filială). */
function writeLegacyStaff(dir, staff) {
  const { dataDir, backupDir } = commonDirectories(dir);
  const { db } = openDatabase({ dataDir, backupDir });
  try {
    db.prepare('INSERT INTO records VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload').run(
      'staff',
      staff.id,
      JSON.stringify(staff),
    );
  } finally {
    db.close();
  }
}

function legacyChild({
  id = 'C-1',
  phone = '069123456',
  phone2 = '123',
  pickupPersons = [{ id: 'PICKUP-1', name: 'Bunica', phone: '069000000' }],
  ...rest
} = {}) {
  const normalized = normalizeRecord('children', {
    id,
    name: 'Copil Unu',
    parent: 'Maria',
    attendanceDate: '2026-09-01',
    ...rest,
  });
  return { ...normalized, phone, phone2, pickupPersons };
}

function legacyVisit({ id = 'VIZ-1', phone = '080123456', ...rest } = {}) {
  const normalized = normalizeRecord('visits', {
    id,
    name: 'Copil vizitator',
    parent: 'Ana',
    date: '2026-09-08',
    time: '10:00',
    status: 'Programată',
    statusChangedAt: '2026-09-01T10:00:00.000Z',
    ...rest,
  });
  return { ...normalized, phone };
}

function legacyStaff(branchId, { id = 'STF-1', phone = '69555555', ...rest } = {}) {
  const normalized = normalizePersonalRecord('staff', {
    id,
    name: 'Elena',
    roleId: 'ROL-educator',
    branchIds: [branchId],
    since: '2026-01-01',
    ...rest,
  });
  return { ...normalized, phone };
}

function collectLog() {
  const lines = [];
  return { log: line => lines.push(line), lines };
}

test('dry-run raportează ce s-ar schimba, fără să scrie nimic', async t => {
  const { get, origin, app, dir } = await startTestApplication(t, { prefix: 'startica-phone-migrate-' });
  const branchId = (await get('/api/session')).branch.id;

  writeLegacyRecord(app, 'children', legacyChild());
  writeLegacyRecord(app, 'visits', legacyVisit());
  writeLegacyStaff(dir, legacyStaff(branchId));

  const { log, lines } = collectLog();
  const result = await runNormalizePhones({ baseUrl: origin, dryRun: true, log });

  assert.equal(result.counts.normalized, 4); // copil.phone, pickup.phone, vizita.phone, staff.phone
  assert.equal(result.counts.invalid, 1); // copil.phone2 ('123')
  assert.ok(lines.some(line => line.includes('Dry-run — nimic scris')));

  // Nimic scris cu adevărat.
  const after = await get('/api/state');
  assert.equal(after.state.children[0].phone, '069123456');
  assert.ok(!('phoneInvalid' in after.state.children[0]));
  const staffAfter = await get('/api/personal/state');
  assert.equal(staffAfter.staff[0].phone, '69555555');
});

test('--execute normalizează telefoanele și marchează phoneInvalid acolo unde rămân invalide', async t => {
  const { get, origin, app, dir } = await startTestApplication(t, { prefix: 'startica-phone-migrate-' });
  const branchId = (await get('/api/session')).branch.id;

  writeLegacyRecord(app, 'children', legacyChild());
  writeLegacyRecord(app, 'visits', legacyVisit({ phone: '+40 721 000 000' }));
  writeLegacyStaff(dir, legacyStaff(branchId));

  const { log } = collectLog();
  await runNormalizePhones({ baseUrl: origin, dryRun: false, log });

  const after = await get('/api/state');
  const savedChild = after.state.children.find(c => c.id === 'C-1');
  assert.equal(savedChild.phone, '+37369123456');
  assert.equal(savedChild.phone2, '123');
  assert.equal(savedChild.phone2Invalid, true);
  assert.equal(savedChild.pickupPersons[0].phone, '+37369000000');

  const savedVisit = after.state.visits.find(v => v.id === 'VIZ-1');
  assert.equal(savedVisit.phone, '+40 721 000 000');
  assert.ok(!('phoneInvalid' in savedVisit));

  const staffAfter = await get('/api/personal/state');
  assert.equal(staffAfter.staff[0].phone, '+37369555555');
  assert.ok(!('phoneInvalid' in staffAfter.staff[0]));
});

test('--execute e idempotent: o a doua rulare nu mai găsește nimic de normalizat', async t => {
  const { get, origin, app, dir } = await startTestApplication(t, { prefix: 'startica-phone-migrate-' });
  const branchId = (await get('/api/session')).branch.id;

  writeLegacyRecord(app, 'children', legacyChild());
  writeLegacyStaff(dir, legacyStaff(branchId));

  await runNormalizePhones({ baseUrl: origin, dryRun: false, log: () => {} });
  const { log, lines } = collectLog();
  const second = await runNormalizePhones({ baseUrl: origin, dryRun: true, log });

  assert.equal(second.counts.normalized, 0);
  // copil.phone2 ('123') rămâne invalid la nesfârșit — nu se poate „repara” singur.
  assert.equal(second.counts.invalid, 1);
  assert.ok(lines.some(line => line.includes('Telefoane găsite')));
});

test('telefoanele din mai multe filiale sunt găsite, fără să dubleze un angajat comun ambelor', async t => {
  const { get, post, origin, app, dir } = await startTestApplication(t, { prefix: 'startica-phone-migrate-' });
  const branchA = (await get('/api/session')).branch.id;
  const createdBranch = await post('/api/branches', { name: 'Botanica' });
  const branchB = createdBranch.body.branch.id;

  writeLegacyRecord(app, 'children', legacyChild({ id: 'C-A', phone: '069123456' }));
  writeLegacyStaff(dir, legacyStaff(branchA, { id: 'STF-BOTH', branchIds: [branchA, branchB] }));

  const selected = await post('/api/branches/select', { id: branchB });
  assert.equal(selected.status, 200);
  // `app.db` urmărește filiala activă (`active.db`) — după comutare, scrie direct în baza B.
  writeLegacyRecord(app, 'children', legacyChild({ id: 'C-B', phone: '080123456' }));
  await post('/api/branches/select', { id: branchA });

  const { log } = collectLog();
  const result = await runNormalizePhones({ baseUrl: origin, dryRun: true, log });

  const staffFindings = result.findings.filter(f => f.kind === 'staff');
  assert.equal(staffFindings.length, 1, 'STF-BOTH nu trebuie numărat de două ori');

  const childIds = result.findings.filter(f => f.kind === 'children').map(f => f.recordId);
  assert.ok(childIds.includes('C-A'));
  assert.ok(childIds.includes('C-B'));
});
