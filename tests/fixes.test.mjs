import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApplication } from '../startica_server.mjs';
import { normalizeRecord, obligation, dueDayFor, CHILD_STATUSES, STATUS_HISTORY_VALUES } from '../shared/domain.mjs';
import { childStatus } from '../shared/excel.mjs';
import { startTestApplication } from './support/start-test-application.mjs';

const temporary = prefix => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  return {
    dir,
    remove() {
      if (resolve(dir).startsWith(resolve(tmpdir()))) rmSync(dir, { recursive: true, force: true });
    },
  };
};

test('Backupul curăță fișierele .tmp rămase de la o întrerupere', async t => {
  const { dir, remove } = temporary('startica-tmp-');
  const backupDir = join(dir, 'backups');
  const app = createApplication({ dataDir: join(dir, 'data'), backupDir });
  t.after(async () => {
    await app.close();
    remove();
  });

  const stale = join(backupDir, 'startica_2020-01-01_pornire_aaaaaaaa.db.tmp');
  const running = join(backupDir, 'startica_2026-01-01_pornire_bbbbbbbb.db.tmp');
  for (const file of [stale, running]) writeFileSync(file, 'continut partial');
  const old = new Date(Date.now() - 7200000);
  utimesSync(stale, old, old);

  app.backup('manual');
  const left = readdirSync(backupDir).filter(n => n.endsWith('.tmp'));
  assert.deepEqual(left, ['startica_2026-01-01_pornire_bbbbbbbb.db.tmp'], 'Doar .tmp-ul recent rămâne.');
});

test('Statutul copilului este restrâns la valorile pe care aplicația le înțelege', () => {
  const base = { id: 'ID-1', name: 'Copil', dueDay: 10 };
  for (const status of CHILD_STATUSES) assert.equal(normalizeRecord('children', { ...base, status }).status, status);
  assert.throws(() => normalizeRecord('children', { ...base, status: 'ORICE TEXT' }), /Statut/);
  assert.equal(normalizeRecord('children', base).status, 'Activ');
  // „De verificat” nu este o stare din care se calculează obligații.
  assert.ok(!STATUS_HISTORY_VALUES.includes('De verificat'));
  assert.throws(
    () => normalizeRecord('children', { ...base, statusHistory: [{ from: '2026-01', status: 'De verificat' }] }),
    /Statut istoric/,
  );
});

test('Importul V5 mapează un statut necunoscut, păstrând textul original', () => {
  assert.deepEqual(childStatus(''), { status: 'Activ', note: '' });
  assert.deepEqual(childStatus('  activ '), { status: 'Activ', note: '' });
  assert.deepEqual(childStatus('Retras'), { status: 'Retras', note: '' });
  const unknown = childStatus('Inactiv temporar');
  assert.equal(unknown.status, 'De verificat');
  assert.match(unknown.note, /Inactiv temporar/);
  // Rândul trebuie să treacă validarea, nu să fie respins.
  const r = normalizeRecord('children', { id: 'ID-1', name: 'Copil', dueDay: 10, status: unknown.status });
  assert.equal(r.status, 'De verificat');
});

// Helper pentru testele care vorbesc cu serverul prin HTTP.
async function startApplication(t, prefix, options = {}) {
  const { dir, get, postJson } = await startTestApplication(t, { prefix, ...options });
  return { dir, backupDir: join(dir, 'backups'), get, post: postJson };
}
const CHILD = { id: 'ID-1', name: 'Copil', dueDay: 10, status: 'Activ' };

test('Backupul automat este rărit; cel dinaintea unui import rămâne obligatoriu', async t => {
  const app = await startApplication(t, 'startica-debounce-', { autoBackupIntervalMs: 300000 });
  const automatic = () => readdirSync(app.backupDir).filter(n => n.includes('_automat_')).length;

  let revision = 0;
  for (let n = 0; n < 5; n++) {
    const result = await app.post('/api/record', {
      type: 'children',
      mode: n === 0 ? 'create' : 'update',
      record: { ...CHILD, phone: String(n) },
      revision,
      requestId: randomUUID(),
    });
    assert.equal(result.ok, true, result.error);
    revision = result.revision;
  }
  assert.equal(revision, 5, 'Toate cele cinci salvări sunt confirmate.');
  // Prima scriere copiază baza, fiindcă nu există încă nicio copie; următoarele
  // patru intră în interval. Înainte de debounce erau cinci copii.
  assert.equal(automatic(), 1, 'Numărul de backupuri automate nu crește cu numărul de salvări.');

  const imported = await app.post('/api/import', {
    state: { children: [CHILD], payments: [], expenses: [], groups: [], categories: [] },
    confirm: 'IMPORT',
    revision,
    requestId: randomUUID(),
  });
  assert.equal(imported.ok, true, imported.error);
  assert.ok(
    readdirSync(app.backupDir).some(n => n.includes('inainte-import')),
    'Copia dinaintea importului nu depinde de interval.',
  );
});

test('Dispariția folderului extern este raportată de starea aplicației, nu la următorul backup', async t => {
  const app = await startApplication(t, 'startica-extern-', { autoBackupIntervalMs: 300000 });
  const external = join(app.dir, 'extern');
  mkdirSync(external);
  const configured = await app.post('/api/settings', { externalDir: external });
  assert.equal(configured.ok, true, configured.error);
  assert.equal((await app.get('/api/health')).externalError, '', 'Cât timp folderul există, nu există eroare.');

  rmSync(external, { recursive: true, force: true });
  assert.match(
    (await app.get('/api/health')).externalError,
    /nu este disponibil/,
    'Problema este vizibilă imediat, fără să aștepte un backup.',
  );
});

test('Un backup eșuat se reîncearcă la următoarea salvare, fără să aștepte intervalul', async t => {
  const app = await startApplication(t, 'startica-retry-', { autoBackupIntervalMs: 300000 });
  const external = join(app.dir, 'extern');
  mkdirSync(external);
  assert.equal((await app.post('/api/settings', { externalDir: external })).ok, true);
  rmSync(external, { recursive: true, force: true });

  // Backupul manual nu este rărit: consemnează eroarea externă.
  const manual = await app.post('/api/backup', {});
  assert.match(manual.warning, /extern/);

  // Salvarea următoare este în interval, dar eroarea cunoscută forțează o
  // nouă încercare, ca utilizatorul să nu creadă că problema s-a rezolvat.
  const saved = await app.post('/api/record', {
    type: 'children',
    mode: 'create',
    record: CHILD,
    revision: 0,
    requestId: randomUUID(),
  });
  assert.equal(saved.ok, true, saved.error);
  assert.match(saved.warning, /extern/, 'Eroarea persistă pe răspunsul salvării.');
});

test('O modificare urmată de inactivitate primește totuși o copie, în afara cererii', async t => {
  const app = await startApplication(t, 'startica-amanat-', { autoBackupIntervalMs: 150 });
  const automatic = () => readdirSync(app.backupDir).filter(n => n.includes('_automat_')).length;

  const first = await app.post('/api/record', {
    type: 'children',
    mode: 'create',
    record: CHILD,
    revision: 0,
    requestId: randomUUID(),
  });
  assert.equal(first.ok, true, first.error);
  const second = await app.post('/api/record', {
    type: 'children',
    mode: 'update',
    record: { ...CHILD, phone: '123' },
    revision: first.revision,
    requestId: randomUUID(),
  });
  assert.equal(second.ok, true, second.error);
  const afterWrites = automatic();

  // Fără alte cereri: copia amânată trebuie să apară singură.
  await new Promise(r => setTimeout(r, 600));
  assert.ok(automatic() > afterWrites, `Copia amânată nu a fost creată (înainte ${afterWrites}, după ${automatic()}).`);
});

test('Scadența vine din data contractului, iar orice obligație cunoscută neachitată se notifică', () => {
  // Contract pe 14 => scadent pe 14 în fiecare lună, notificare din 11.
  const c = normalizeRecord('children', {
    id: 'ID-1',
    name: 'Copil',
    status: 'Activ',
    contractDate: '2024-11-14',
    attendanceDate: '2024-12-02',
    dueDay: 10,
    feeHistory: [{ from: '2024-12', amount: 2000 }],
    statusHistory: [{ from: '2024-12', status: 'Activ' }],
  });
  assert.equal(dueDayFor(c), 14, 'Ziua din contract are prioritate față de dueDay.');
  assert.equal(dueDayFor({ dueDay: 10 }), 10, 'Fără contract se folosește dueDay.');
  assert.equal(dueDayFor({}), 10, 'Fără nimic, ziua implicită.');

  const at = day => obligation(c, '2026-09', [], day);
  assert.equal(at('2026-09-14').due, '2026-09-14');
  // notify nu mai e condiționat de fereastra de 3 zile: orice rest neachitat
  // apare pe listă din prima zi a lunii; doar eticheta arată apropierea de
  // scadență, iar restanțele rămân evidențiate separat (label + late-row).
  for (const [day, label, notify] of [
    ['2026-09-10', 'Nescadent', true],
    ['2026-09-11', 'Scadent în curând', true],
    ['2026-09-14', 'Scadent în curând', true],
    ['2026-09-15', 'Restanță', true],
  ]) {
    assert.equal(at(day).label, label, `eticheta pentru ${day}`);
    assert.equal(at(day).notify, notify, `notificare pentru ${day}`);
  }
  assert.equal(at('2026-09-11').daysToDue, 3);
  assert.equal(at('2026-09-15').daysToDue, -1);

  // Luna scurtă: contract pe 31, februarie are 28.
  assert.equal(obligation({ ...c, contractDate: '2024-01-31' }, '2027-02', [], '2027-02-01').due, '2027-02-28');

  // Achitat integral => nu se notifică, oricât de târziu ar fi.
  const paid = [
    normalizeRecord('payments', {
      id: 'PAY-1',
      childId: 'ID-1',
      date: '2026-09-01',
      amount: 2000,
      allocations: [{ month: '2026-09', amount: 2000 }],
    }),
  ];
  assert.equal(obligation(c, '2026-09', paid, '2026-09-30').notify, false);
  assert.equal(obligation(c, '2026-09', paid, '2026-09-30').label, 'Plătit');

  // Fără elementele care definesc obligația, fișa se verifică manual și nu
  // generează notificări bazate pe presupuneri.
  for (const incomplete of [
    { ...c, feeHistory: [] },
    { ...c, attendanceDate: '' },
    { ...c, status: 'De verificat', statusHistory: [] },
  ]) {
    const result = obligation(incomplete, '2026-09', [], '2026-09-30');
    assert.equal(result.label, 'De verificat');
    assert.equal(result.notify, false);
  }

  // Taxa zero este o obligație cunoscută, achitată integral prin definiție.
  const zeroFee = obligation({ ...c, feeHistory: [{ from: '2024-12', amount: 0 }] }, '2026-09', [], '2026-09-30');
  assert.equal(zeroFee.label, 'Plătit');
  assert.equal(zeroFee.notify, false);
  // Retras => fără obligație.
  assert.equal(
    obligation({ ...c, statusHistory: [{ from: '2026-08', status: 'Retras' }] }, '2026-09', [], '2026-09-30').notify,
    false,
  );
});

test('Asocierea în masă leagă achitările și nu suprascrie una deja atribuită', async t => {
  const app = await startApplication(t, 'startica-asoc-', { autoBackupIntervalMs: 0 });
  const child = normalizeRecord('children', {
    id: 'CSV-1',
    name: 'Florea Mark',
    status: 'Activ',
    contractDate: '2025-01-14',
    attendanceDate: '2025-02-01',
    feeHistory: [{ from: '2025-02', amount: 12000 }],
    statusHistory: [{ from: '2025-02', status: 'Activ' }],
  });
  const payments = [
    normalizeRecord('payments', {
      id: 'PAY-1',
      date: '2026-09-01',
      amount: 12000,
      sourceName: 'Mark',
      allocations: [{ month: '2026-09', amount: 12000 }],
    }),
    normalizeRecord('payments', {
      id: 'PAY-2',
      childId: 'CSV-1',
      date: '2026-08-01',
      amount: 12000,
      allocations: [{ month: '2026-08', amount: 12000 }],
    }),
  ];
  let r = await app.post('/api/import', {
    state: { children: [child], payments, expenses: [], groups: [], categories: [] },
    confirm: 'IMPORT',
    revision: 0,
    requestId: randomUUID(),
  });
  assert.equal(r.ok, true, r.error);

  // Neasociată => copilul apare ca restanțier deși banii au intrat.
  assert.equal(obligation(r.state.children[0], '2026-09', r.state.payments, '2026-09-30').notify, true);

  r = await app.post('/api/payments-assign', {
    assignments: [{ id: 'PAY-1', childId: 'CSV-1' }],
    revision: r.revision,
    requestId: randomUUID(),
  });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.state.payments.find(p => p.id === 'PAY-1').childId, 'CSV-1');
  assert.equal(
    obligation(r.state.children[0], '2026-09', r.state.payments, '2026-09-30').notify,
    false,
    'După asociere, copilul nu mai este pe lista de notificat.',
  );
  assert.ok(readdirSync(app.backupDir).some(n => n.includes('inainte-asociere-achitari')));

  // O achitare deja atribuită nu poate fi reasociată din greșeală de aici.
  const refused = await app.post('/api/payments-assign', {
    assignments: [{ id: 'PAY-2', childId: 'CSV-1' }],
    revision: r.revision,
    requestId: randomUUID(),
  });
  assert.match(refused.error, /are deja un copil asociat/);
  // Un copil inexistent oprește tot.
  const bad = await app.post('/api/payments-assign', {
    assignments: [{ id: 'PAY-1', childId: 'LIPSA' }],
    revision: r.revision,
    requestId: randomUUID(),
  });
  assert.ok(bad.error, 'Asocierea către un copil inexistent este respinsă.');
});

test('Normalizarea păstrează fiecare câmp real și elimină restul', () => {
  // Lista provine din inventarul bazei reale: 105 fișe, 810 achitări, 1201
  // cheltuieli. Dacă unul dintre câmpurile astea ar fi eliminat, restaurarea
  // unui backup vechi ar pierde date în tăcere.
  const real = {
    children: {
      id: 'CSV-1',
      contractNumber: '1',
      name: 'Copil',
      parent: 'P1',
      phone: '060',
      parent2: 'P2',
      phone2: '061',
      birthDate: '2020-01-02',
      contractDate: '2024-11-14',
      attendanceDate: '2024-12-02',
      withdrawalDate: '2026-01-05',
      status: 'Activ',
      groupId: 'GRP-mica',
      fee: 2000,
      feeHistory: [{ from: '2024-12', amount: 2000 }],
      statusHistory: [{ from: '2024-12', status: 'Activ' }],
      dueDay: 14,
      notes: 'observatii',
      verification: 'OK',
      archived: false,
      archivedAt: '',
    },
    payments: {
      id: 'PAY-1',
      date: '2026-09-01',
      childId: 'CSV-1',
      childName: 'Copil',
      sourceName: 'sursa',
      sourceChildId: 'ID-9',
      group: 'Mica',
      method: 'Cash',
      amount: 2000,
      allocations: [{ month: '2026-09', amount: 2000 }],
      month: '2026-09',
      type: 'lunar',
      notes: 'n',
      verification: 'OK',
      original: 'text sursa',
      reviewed: true,
      importSource: { kind: 'v5-financial', recordId: 'X' },
      archived: false,
      archivedAt: '',
    },
    expenses: {
      id: 'EXP-1',
      date: '2026-09-01',
      category: 'Altele',
      description: 'd',
      amount: 10,
      notes: 'n',
      importSource: { kind: 'v5-financial', recordId: 'Y' },
      archived: false,
      archivedAt: '',
    },
  };
  for (const [type, record] of Object.entries(real)) {
    const clean = normalizeRecord(type, record);
    for (const field of Object.keys(record))
      assert.ok(field in clean, `${type}: câmpul ${field} a fost eliminat, deși există în datele reale`);
  }

  // Ce nu e în model nu mai ajunge în bază.
  const withJunk = normalizeRecord('children', { ...real.children, campNecunoscut: { a: 1 }, altceva: 'x' });
  assert.ok(!('campNecunoscut' in withJunk));
  assert.ok(!('altceva' in withJunk));
  // Un câmp al altui tip nu trece nici el.
  assert.ok(!('tenders' in normalizeRecord('expenses', { ...real.expenses, tenders: [] })));
});
