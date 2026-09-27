import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { today } from '#shared/domain/calendar-month.mjs';
import { bnmDateParam } from '#shared/domain/exchange-rates.mjs';
import { createApplication, startTestApplication } from '#test-support/start-test-application.mjs';

const XML_WITH_EUR = `<ValCurs Date="23.09.2026"><Valute ID="47"><CharCode>EUR</CharCode><Value>20.1352</Value></Valute></ValCurs>`;

/** @param {string} id */
const child = id =>
  normalizeRecord('children', {
    id,
    name: 'Copil ' + id,
    status: 'Activ',
    attendanceDate: '2026-09-01',
    fee: 2000,
    dueDay: 10,
    feeHistory: [{ from: '2026-09', amount: 2000 }],
  });
/** @param {string} id */
const group = id => normalizeRecord('groups', { id, name: 'Grupa ' + id });

test('nicio dată a unei filiale nu apare în cealaltă', async t => {
  const bundle = await startTestApplication(t, { prefix: 'startica-branches-' });
  const { get, post } = bundle;

  // Filiala A (migrată, deja activă): un copil, o grupă, un șablon SMS, o prezență,
  // numele grădiniței și un backup — criteriul 2 din 17-filiale.md.
  let response = await post('/api/record', {
    record: child('ID-A'),
    type: 'children',
    revision: 0,
    mode: 'create',
    requestId: randomUUID(),
  });
  assert.equal(response.status, 200);
  response = await post('/api/record', {
    record: group('GRP-A'),
    type: 'groups',
    revision: response.body.revision,
    mode: 'create',
    requestId: randomUUID(),
  });
  assert.equal(response.status, 200);
  assert.equal((await post('/api/sms-template-save', { name: 'Amintire', body: 'Salut!' })).status, 200);
  assert.equal(
    (await post('/api/attendance', { changes: [{ childId: 'ID-A', date: '2026-09-01', status: 'present' }] })).status,
    200,
  );
  assert.equal((await post('/api/kindergarten', { name: 'Buiucani' })).status, 200);
  assert.equal((await post('/api/backup', {})).status, 200);

  const sessionA = await get('/api/session');
  const branchAId = sessionA.branch.id;
  const healthA = await get('/api/health');

  const created = await post('/api/branches', { name: 'Botanica' });
  assert.equal(created.status, 200);
  const branchB = created.body.branch;
  assert.notEqual(branchB.id, branchAId);

  const selected = await post('/api/branches/select', { id: branchB.id });
  assert.equal(selected.status, 200);
  assert.equal(selected.body.branch.id, branchB.id);

  assert.equal((await get('/api/state')).state.children.length, 0);
  assert.equal((await get('/api/state')).state.groups.length, 0);
  // Fiecare filială (nouă sau migrată) primește propriul șablon implicit la deschidere
  // (createSmsTemplateRepository) — nu e o scurgere din A dacă apare și în B, dar șablonul
  // salvat explicit în A („Amintire”) nu are voie să apară.
  assert.ok(!(await get('/api/sms-templates')).templates.some(template => template.name === 'Amintire'));
  assert.deepEqual((await get('/api/attendance?date=2026-09-01')).entries, []);
  assert.equal((await get('/api/kindergarten')).name, '');
  assert.deepEqual(await get('/api/backups'), []);
  const healthB = await get('/api/health');
  assert.notEqual(healthB.database, healthA.database);

  response = await post('/api/record', {
    record: child('ID-B'),
    type: 'children',
    revision: 0,
    mode: 'create',
    requestId: randomUUID(),
  });
  assert.equal(response.status, 200);

  const backToA = await post('/api/branches/select', { id: branchAId });
  assert.equal(backToA.status, 200);
  const stateA = await get('/api/state');
  assert.equal(stateA.state.children.length, 1);
  assert.equal(stateA.state.children[0].id, 'ID-A');
  assert.equal((await get('/api/kindergarten')).name, 'Buiucani');
});

test('selectarea aceleiași filiale e no-op', async t => {
  const bundle = await startTestApplication(t, { prefix: 'startica-branches-' });
  const session = await bundle.get('/api/session');

  const response = await bundle.post('/api/branches/select', { id: session.branch.id });

  assert.equal(response.status, 200);
  assert.equal(response.body.branch.id, session.branch.id);
  assert.equal((await bundle.get('/api/session')).branch.id, session.branch.id);
});

test('o filială cu baza coruptă nu se deschide, iar cea curentă rămâne activă', async t => {
  const bundle = await startTestApplication(t, { prefix: 'startica-branches-' });
  const created = await bundle.post('/api/branches', { name: 'Botanica' });
  const branchB = created.body.branch;

  // Corupe baza filialei B înainte de a fi vreodată deschisă de un context (decizia 5: folderul
  // și baza există deja de la creare).
  writeFileSync(join(bundle.dir, 'Filiale', branchB.folder, 'Startica_Date', 'startica.db'), 'nu e sqlite');

  const response = await bundle.post('/api/branches/select', { id: branchB.id });

  assert.equal(response.status, 500);
  assert.match(response.body.error, /nu s-a putut deschide/);
  const session = await bundle.get('/api/session');
  assert.notEqual(session.branch.id, branchB.id, 'filiala curentă trebuie să rămână cea de dinainte');
  assert.equal((await bundle.get('/api/state')).revision, 0, 'filiala curentă rămâne funcțională după eșec');
});

test('ultima filială deschisă e reținută și se deschide la repornire', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'startica-branches-restart-'));
  try {
    const first = createApplication({
      dataDir: join(dir, 'data'),
      backupDir: join(dir, 'backups'),
      home: dir,
      autoBackupIntervalMs: 0,
    });
    await new Promise(done => first.server.listen(0, '127.0.0.1', done));
    const origin = `http://127.0.0.1:${/** @type {import('node:net').AddressInfo} */ (first.server.address()).port}`;
    const token = (await (await fetch(origin + '/api/session')).json()).token;
    const authorizedPost = (path, body) =>
      fetch(origin + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Startica-Token': token },
        body: JSON.stringify(body),
      }).then(response => response.json());
    const branchB = (await authorizedPost('/api/branches', { name: 'Botanica' })).branch;
    const selected = await authorizedPost('/api/branches/select', { id: branchB.id });
    assert.equal(selected.branch.id, branchB.id);
    // Închiderea filialei vechi e amânată cu un tick (create-application.mjs, decizia 2) — se
    // lasă timp acelui timer să ruleze înainte să reîncercăm exact același folder mai jos.
    await new Promise(resolve => setTimeout(resolve, 0));
    await first.close();

    const second = createApplication({
      dataDir: join(dir, 'data'),
      backupDir: join(dir, 'backups'),
      home: dir,
      autoBackupIntervalMs: 0,
    });
    assert.equal(second.activeBranch().id, branchB.id);
    second.closeSync();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('records citește doar filiala cerută și refuză filiala deschisă', async t => {
  const bundle = await startTestApplication(t, { prefix: 'startica-branches-' });
  const session = await bundle.get('/api/session');

  const deniedForActive = await fetch(`${bundle.origin}/api/branches/records?id=${session.branch.id}`);
  assert.equal(deniedForActive.status, 400);
  assert.match((await deniedForActive.json()).error, /api\/state/);

  assert.equal(
    (
      await bundle.post('/api/record', {
        record: child('ID-A'),
        type: 'children',
        revision: 0,
        mode: 'create',
        requestId: randomUUID(),
      })
    ).status,
    200,
  );
  const branchB = (await bundle.post('/api/branches', { name: 'Botanica' })).body.branch;

  const recordsForB = await fetch(`${bundle.origin}/api/branches/records?id=${branchB.id}`);
  assert.equal(recordsForB.status, 200);
  assert.deepEqual((await recordsForB.json()).state.children, []);

  const missing = await fetch(`${bundle.origin}/api/branches/records?id=id-inexistent`);
  assert.equal(missing.status, 404);
});

test('cursul BNM se completează la deschiderea unei filiale', async t => {
  const todayStr = today();
  const { promise: lastCallDone, resolve: onLastCall } = Promise.withResolvers();
  const fetch = async url => {
    const requestedDate = new URL(url).searchParams.get('date');
    // Completarea retroactivă cere zilele în ordine crescătoare; ultima cerută e mereu azi —
    // semnalul de mai jos marchează sfârșitul buclei din refreshExchangeRateIfMissing, fără
    // polling arbitrar de timp (vezi create-branch-context.mjs).
    if (requestedDate === bnmDateParam(todayStr)) onLastCall();
    return { ok: true, text: async () => XML_WITH_EUR };
  };
  const bundle = await startTestApplication(t, { prefix: 'startica-branches-', fetch });

  const branchB = (await bundle.post('/api/branches', { name: 'Botanica' })).body.branch;
  const selected = await bundle.post('/api/branches/select', { id: branchB.id });
  assert.equal(selected.status, 200);

  await lastCallDone;
  await new Promise(resolve => setTimeout(resolve, 0));

  const rates = (await bundle.get('/api/exchange-rates')).rates;
  assert.ok(Object.hasOwn(rates, todayStr), 'cursul BNM al zilei curente nu s-a completat la deschiderea filialei B');
});
