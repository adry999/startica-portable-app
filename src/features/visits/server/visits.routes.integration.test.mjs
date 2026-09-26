import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startTestApplication } from '#test-support/start-test-application.mjs';

// Testele lovesc rutele HTTP, nu funcția: acoperă și înregistrarea lor în createApplication.

async function startApplication(t) {
  return startTestApplication(t, { prefix: 'startica-visits-' });
}

const importRequest = (state, revision) => ({ state, confirm: 'IMPORT', revision, requestId: randomUUID() });
const emptyImport = overrides => ({
  children: [],
  payments: [],
  expenses: [],
  groups: [],
  categories: [],
  visits: [],
  ...overrides,
});

// Statut implicit Efectuată: fișierul testează mai ales /api/visits-enrol, care acum
// cere explicit vizita Efectuată — testele care vor alt statut îl suprascriu punctual.
const visit = (overrides = {}) => ({
  id: 'VIZ-1',
  name: 'Popescu Ana',
  parent: 'Popescu Ion',
  phone: '0722000000',
  date: '2026-09-20',
  time: '10:00',
  status: 'Efectuată',
  statusChangedAt: '2026-09-10T08:00:00.000Z',
  healthNotes: 'Alergie la nuci',
  desiredGroupId: null,
  ...overrides,
});

const newChild = (overrides = {}) => ({
  id: 'CH-NOU',
  name: 'Popescu Ana',
  parent: 'Popescu Ion',
  phone: '0722000000',
  groupId: null,
  status: 'Activ',
  healthNotes: '',
  ...overrides,
});

test('înscrierea creează fișa copilului, marchează vizita Înscris și consemnează două intrări în istoric', async t => {
  const { get, post } = await startApplication(t);
  const imported = await post('/api/import', importRequest(emptyImport({ visits: [visit()] }), 0));
  assert.equal(imported.status, 200, imported.body.error);

  const result = await post('/api/visits-enrol', {
    visitId: 'VIZ-1',
    child: newChild(),
    revision: imported.body.revision,
    requestId: randomUUID(),
  });

  assert.equal(result.status, 200, result.body.error);
  assert.equal(result.body.childId, 'CH-NOU');
  const child = result.body.state.children.find(c => c.id === 'CH-NOU');
  assert.ok(child, 'Fișa copilului a fost creată.');
  const updatedVisit = result.body.state.visits.find(v => v.id === 'VIZ-1');
  assert.equal(updatedVisit.status, 'Înscris');
  assert.equal(updatedVisit.childId, 'CH-NOU');
  assert.equal(updatedVisit.healthNotes, '', 'Notele medicale au fost mutate la copil.');
  assert.equal(updatedVisit.history.at(-1).status, 'Înscris');

  const audit = await get('/api/audit');
  const enrolEntries = audit.entries.filter(entry => entry.action === 'modificare' || entry.action === 'adăugare');
  assert.equal(enrolEntries.length, 2, 'O intrare pentru vizită și una pentru copil, pe lângă cea de import.');
  const visitEntry = enrolEntries.find(entry => entry.recordType === 'visits');
  const childEntry = enrolEntries.find(entry => entry.recordType === 'children');
  assert.equal(visitEntry.action, 'modificare');
  assert.equal(visitEntry.before.healthNotes, '[date medicale]', 'Vizita din istoric e redactată.');
  assert.equal(visitEntry.after.healthNotes, '');
  assert.equal(childEntry.action, 'adăugare');
  assert.equal(childEntry.recordId, 'CH-NOU');
});

test('refuză înscrierea pentru o vizită inexistentă (409)', async t => {
  const { get, post } = await startApplication(t);
  const state0 = await get('/api/state');

  const result = await post('/api/visits-enrol', {
    visitId: 'VIZ-LIPSA',
    child: newChild(),
    revision: state0.revision,
    requestId: randomUUID(),
  });

  assert.equal(result.status, 409);
  assert.match(result.body.error, /nu mai există/);
});

test('refuză înscrierea unei vizite deja înscrise (409)', async t => {
  const { post } = await startApplication(t);
  const enrolledChild = { id: 'CH-VECHI', name: 'Cineva', parent: 'Cineva', phone: '', dueDay: 10, status: 'Activ' };
  const enrolledVisit = visit({ status: 'Înscris', childId: 'CH-VECHI' });
  const imported = await post(
    '/api/import',
    importRequest(emptyImport({ children: [enrolledChild], visits: [enrolledVisit] }), 0),
  );

  const result = await post('/api/visits-enrol', {
    visitId: 'VIZ-1',
    child: newChild(),
    revision: imported.body.revision,
    requestId: randomUUID(),
  });

  assert.equal(result.status, 409);
  assert.match(result.body.error, /deja înscris/);
});

test('refuză înscrierea unei vizite care nu e Efectuată (400)', async t => {
  const { post } = await startApplication(t);
  const imported = await post(
    '/api/import',
    importRequest(emptyImport({ visits: [visit({ status: 'Programată' })] }), 0),
  );

  const result = await post('/api/visits-enrol', {
    visitId: 'VIZ-1',
    child: newChild(),
    revision: imported.body.revision,
    requestId: randomUUID(),
  });

  assert.equal(result.status, 400);
  assert.match(result.body.error, /trebuie marcată Efectuată/);
});

test('refuză o grupă inexistentă pentru copilul nou (400)', async t => {
  const { post } = await startApplication(t);
  const imported = await post('/api/import', importRequest(emptyImport({ visits: [visit()] }), 0));

  const result = await post('/api/visits-enrol', {
    visitId: 'VIZ-1',
    child: newChild({ groupId: 'GRP-LIPSA' }),
    revision: imported.body.revision,
    requestId: randomUUID(),
  });

  assert.equal(result.status, 400);
  assert.match(result.body.error, /Grupa asociată nu există/);
});

test('reluarea aceleiași cereri (același requestId) nu înscrie de două ori', async t => {
  const { get, post } = await startApplication(t);
  const imported = await post('/api/import', importRequest(emptyImport({ visits: [visit()] }), 0));
  const body = { visitId: 'VIZ-1', child: newChild(), revision: imported.body.revision, requestId: randomUUID() };

  const first = await post('/api/visits-enrol', body);
  assert.equal(first.status, 200, first.body.error);
  const second = await post('/api/visits-enrol', body);

  assert.equal(second.status, 200, second.body.error);
  assert.equal(second.body.replayed, true);
  assert.equal(second.body.childId, first.body.childId);
  assert.deepEqual(second.body.state, first.body.state);
  const audit = await get('/api/audit');
  const enrolEntries = audit.entries.filter(entry => entry.action === 'modificare' || entry.action === 'adăugare');
  assert.equal(enrolEntries.length, 2, 'Reluarea nu adaugă o a doua pereche de intrări în istoric.');
});

test('o revizie veche este respinsă cu 409', async t => {
  const { post } = await startApplication(t);
  const imported = await post('/api/import', importRequest(emptyImport({ visits: [visit()] }), 0));

  const result = await post('/api/visits-enrol', {
    visitId: 'VIZ-1',
    child: newChild(),
    revision: imported.body.revision - 1,
    requestId: randomUUID(),
  });

  assert.equal(result.status, 409);
});

test('expireHealthNotes golește notele medicale vechi, cu o singură revizie și audit', async t => {
  const { app, get, post } = await startApplication(t);
  const oldVisit = visit({ id: 'VIZ-VECHI', statusChangedAt: '2025-01-01T00:00:00.000Z' });
  const recentVisit = visit({ id: 'VIZ-RECENT', statusChangedAt: '2026-09-01T00:00:00.000Z' });
  const oldChild = {
    id: 'CH-VECHI',
    name: 'Cineva',
    parent: 'Cineva',
    phone: '',
    dueDay: 10,
    status: 'Activ',
    archived: true,
    archivedAt: '2025-01-01T00:00:00.000Z',
    healthNotes: 'Astm',
  };
  const imported = await post(
    '/api/import',
    importRequest(emptyImport({ children: [oldChild], visits: [oldVisit, recentVisit] }), 0),
  );
  const revisionBefore = imported.body.revision;

  const result = app.expireHealthNotes('2026-09-11');

  assert.equal(result.expired, 2);
  assert.equal(result.revision, revisionBefore + 1);

  const { state } = await get('/api/state');
  assert.equal(state.visits.find(v => v.id === 'VIZ-VECHI').healthNotes, '');
  assert.equal(state.visits.find(v => v.id === 'VIZ-RECENT').healthNotes, recentVisit.healthNotes);
  assert.equal(state.children.find(c => c.id === 'CH-VECHI').healthNotes, '');

  const audit = await get('/api/audit');
  const expiryEntries = audit.entries.filter(entry => entry.action === 'expirare date medicale');
  assert.equal(expiryEntries.length, 2);
});

test('expireHealthNotes nu scrie nimic când nu există note medicale expirate', async t => {
  const { app, get, post } = await startApplication(t);
  const imported = await post('/api/import', importRequest(emptyImport({ visits: [visit()] }), 0));
  const revisionBefore = imported.body.revision;

  const result = app.expireHealthNotes('2026-09-11');

  assert.deepEqual(result, { expired: 0 });
  const { revision } = await get('/api/state');
  assert.equal(revision, revisionBefore);
  const audit = await get('/api/audit');
  assert.equal(
    audit.entries.filter(entry => entry.action === 'expirare date medicale').length,
    0,
    'Nicio scriere nouă în istoric.',
  );
});
