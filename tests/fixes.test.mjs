import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApplication } from '../startica_server.mjs';
import { normalizeRecord, obligation, dueDayFor, CHILD_STATUSES, STATUS_HISTORY_VALUES } from '../domain.mjs';
import { childStatus } from '../excel.mjs';
import { suggestChildren } from '../payment-matching.mjs';

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
  const { dir, remove } = temporary(prefix);
  const backupDir = join(dir, 'backups');
  const app = createApplication({ dataDir: join(dir, 'data'), backupDir, ...options });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  t.after(async () => {
    await app.close();
    remove();
  });
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  const token = (await (await fetch(origin + '/api/session')).json()).token;
  return {
    dir,
    backupDir,
    get: path => fetch(origin + path).then(r => r.json()),
    post: (path, body) =>
      fetch(origin + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Startica-Token': token },
        body: JSON.stringify(body),
      }).then(r => r.json()),
  };
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
    state: { children: [CHILD], payments: [], expenses: [] },
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

test('Scadența vine din data contractului, iar notificarea începe cu 3 zile înainte', () => {
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
  for (const [day, label, notify] of [
    ['2026-09-10', 'Nescadent', false],
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

  // Fără taxă nu se poate evalua, deci nu se notifică pe baza unei presupuneri.
  assert.equal(obligation({ ...c, feeHistory: [] }, '2026-09', [], '2026-09-30').notify, false);
  // Retras => fără obligație.
  assert.equal(
    obligation({ ...c, statusHistory: [{ from: '2026-08', status: 'Retras' }] }, '2026-09', [], '2026-09-30').notify,
    false,
  );
});

test('Completarea în masă face fișele evaluabile și e o singură operațiune', async t => {
  const app = await startApplication(t, 'startica-taxe-', { autoBackupIntervalMs: 0 });
  const children = ['A', 'B'].map((n, i) =>
    normalizeRecord('children', {
      id: 'CSV-' + (i + 1),
      contractNumber: String(i + 1),
      name: 'Copil ' + n,
      status: 'De verificat',
      contractDate: '2025-01-14',
      attendanceDate: '2025-02-03',
    }),
  );
  let r = await app.post('/api/import', {
    state: { children, payments: [], expenses: [] },
    confirm: 'IMPORT',
    revision: 0,
    requestId: randomUUID(),
  });
  assert.equal(r.ok, true, r.error);

  // Înainte: fără taxă și fără statut, nimic nu se poate calcula.
  const before = obligation(r.state.children[0], '2026-09', [], '2026-09-30');
  assert.equal(before.label, 'De verificat');
  assert.equal(before.notify, false);

  const updates = children.map(c => ({ id: c.id, fee: 2000, from: '2025-02', group: 'Grupa mică', status: 'Activ' }));
  r = await app.post('/api/children-setup', { updates, revision: r.revision, requestId: randomUUID() });
  assert.equal(r.ok, true, r.error);

  const after = obligation(r.state.children[0], '2026-09', [], '2026-09-30');
  assert.equal(after.label, 'Restanță');
  assert.equal(after.notify, true);
  assert.equal(after.expected, 2000);
  assert.equal(after.due, '2026-09-14', 'Scadența vine tot din data contractului.');
  assert.equal(r.state.children[0].group, 'Grupa mică');
  assert.deepEqual(r.state.children[0].feeHistory, [{ from: '2025-02', amount: 2000 }]);
  assert.deepEqual(r.state.children[0].statusHistory, [{ from: '2025-02', status: 'Activ' }]);

  // O singură revizie pentru toate fișele, plus copia obligatorie și jurnalul.
  assert.equal(r.revision, 2, 'Toate completările intră într-o singură operațiune.');
  assert.ok(readdirSync(app.backupDir).some(n => n.includes('inainte-completare-taxe')));
  const audit = await app.get('/api/audit');
  assert.equal(audit.filter(a => a.action === 'completare taxe și grupe').length, 2);

  // Un id inexistent oprește tot; nimic nu se scrie pe jumătate.
  const bad = await app.post('/api/children-setup', {
    updates: [
      { id: 'CSV-1', fee: 3000, from: '2025-02' },
      { id: 'LIPSA', fee: 1, from: '2025-02' },
    ],
    revision: r.revision,
    requestId: randomUUID(),
  });
  assert.match(bad.error, /nu mai există/);
  const state = await app.get('/api/state');
  assert.equal(state.state.children[0].fee, 2000, 'Prima fișă nu a fost modificată.');
  assert.equal(state.revision, r.revision, 'Revizia nu s-a schimbat.');
});

test('Sugestiile de asociere separă potrivirea pe nume de simpla coincidență de sumă', () => {
  const fee = [{ from: '2025-01', amount: 12000 }];
  const children = [
    { id: 'A', name: 'Florea Mark', feeHistory: fee },
    { id: 'B', name: 'Taburceanu Stefan', feeHistory: fee },
    { id: 'C', name: 'Gorea Elizaveta', feeHistory: fee },
  ];
  const empty = new Map();
  const payment = (sourceName, amount = 12000) => ({
    sourceName,
    amount,
    allocations: [{ month: '2025-09', amount }],
  });

  const named = suggestChildren(payment('Mark'), children, empty);
  assert.equal(named[0].id, 'A', 'Numele din sursă decide primul candidat.');
  assert.equal(named[0].nameMatch, true);
  assert.equal(
    named.filter(s => s.nameMatch).length,
    1,
    'Un singur copil are numele potrivit; ceilalți rămân simple coincidențe.',
  );
  assert.ok(
    named.slice(1).every(s => s.nameMatch === false),
    'Ceilalți candidați nu au potrivire de nume.',
  );

  // Diacriticele nu trebuie să împiedice potrivirea.
  assert.equal(suggestChildren(payment('(Gorea Elizaveta)'), children, empty)[0].id, 'C');

  // Text fără nume: pot exista candidați după sumă, dar niciunul nu se poate
  // accepta în masă.
  const noise = suggestChildren(payment('achitare gemeni 6 luni', 72000), children, empty);
  assert.ok(
    noise.every(s => s.nameMatch === false),
    'Cuvintele-zgomot nu produc potriviri de nume.',
  );

  // O lună deja achitată scade scorul față de una neachitată.
  const paidIndex = new Map([['A', new Map([['2025-09', 1200000]])]]);
  const afterPaid = suggestChildren(payment('Mark'), children, paidIndex);
  assert.equal(afterPaid[0].id, 'A', 'Numele rămâne decisiv.');
  assert.ok(!afterPaid[0].reasons.some(r => r.includes('neachitată')));
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
    state: { children: [child], payments, expenses: [] },
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
