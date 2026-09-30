import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startTestApplication } from '#test-support/start-test-application.mjs';
import { today } from '#shared/domain/calendar-month.mjs';

// Lună sigur încheiată, indiferent de data reală de rulare a testelor (M4: pay() refuză o
// lună care nu s-a încheiat) — angajatul e activ dinainte de ea, ca salariul să fie întreg.
const CLOSED_MONTH = '2025-06';

/** @param {string} branchId */
const staffInput = branchId => ({
  id: 'STF-1',
  name: 'Ana Popescu',
  roleId: 'ROL-educator',
  branchIds: [branchId],
  since: '2025-01-01',
});

/** @param {string} origin @param {string} path */
const getWithStatus = async (origin, path) => {
  const response = await fetch(origin + path);
  return { status: response.status, body: await response.json() };
};

async function setUpStaffAndSalary(get, post) {
  const branchId = (await get('/api/session')).branch.id;
  await post('/api/personal/staff', { mode: 'create', staff: staffInput(branchId) });
  await post('/api/personal/pin', { pin: '1234' });
  return branchId;
}

test('salariile, avansurile și istoricul răspund 403 fără PIN, 429 după 5 greșeli, și se blochează cu /lock', async t => {
  const { get, post, origin } = await startTestApplication(t, { prefix: 'startica-personal-pin-' });
  await setUpStaffAndSalary(get, post);

  assert.equal((await getWithStatus(origin, `/api/personal/salaries?month=${CLOSED_MONTH}`)).status, 403);
  assert.equal((await getWithStatus(origin, '/api/personal/advances?year=2025')).status, 403);
  assert.equal((await getWithStatus(origin, '/api/personal/salaries/history?staffId=STF-1')).status, 403);

  for (let attempt = 0; attempt < 5; attempt++)
    assert.equal((await post('/api/personal/pin/unlock', { pin: '0000' })).status, 403);
  assert.equal((await post('/api/personal/pin/unlock', { pin: '1234' })).status, 429);

  const status = await get('/api/personal/pin');
  assert.equal(status.configured, true);
  assert.equal(status.unlocked, false);
});

test('cu PIN corect, salariile se văd; /lock protejează din nou fără să șteargă PIN-ul', async t => {
  const { get, post, origin } = await startTestApplication(t, { prefix: 'startica-personal-pin-unlock-' });
  await setUpStaffAndSalary(get, post);

  let response = await post('/api/personal/pin/unlock', { pin: '1234' });
  assert.equal(response.status, 200);
  assert.equal((await get('/api/personal/pin')).unlocked, true);

  response = await post('/api/personal/salaries', {
    id: 'SAL-1',
    staffId: 'STF-1',
    mode: 'fix',
    amount: 4400,
    validFrom: '2025-01',
  });
  assert.equal(response.status, 200);

  const salaries = await get(`/api/personal/salaries?month=${CLOSED_MONTH}`);
  assert.equal(salaries.rows.length, 1);
  assert.equal(salaries.rows[0].gross, 4400);

  response = await post('/api/personal/pin/lock', {});
  assert.equal(response.status, 200);
  assert.equal((await getWithStatus(origin, `/api/personal/salaries?month=${CLOSED_MONTH}`)).status, 403);
});

test('state-ul personalului nu conține sume, chiar și cu salarii configurate', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-personal-pin-state-' });
  await setUpStaffAndSalary(get, post);
  await post('/api/personal/pin/unlock', { pin: '1234' });
  await post('/api/personal/salaries', {
    id: 'SAL-1',
    staffId: 'STF-1',
    mode: 'fix',
    amount: 4400,
    validFrom: '2025-01',
  });

  const state = await get('/api/personal/state');
  assert.equal(JSON.stringify(state).includes('4400'), false);
});

test('plata unui angajat creează o cheltuială Salarii vizibilă în cheltuielile filialei', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-personal-pay-' });
  await setUpStaffAndSalary(get, post);
  await post('/api/personal/pin/unlock', { pin: '1234' });
  await post('/api/personal/salaries', {
    id: 'SAL-1',
    staffId: 'STF-1',
    mode: 'fix',
    amount: 4400,
    validFrom: '2025-01',
  });

  const revision = (await get('/api/state')).revision;
  const response = await post('/api/personal/salaries/pay', {
    staffIds: ['STF-1'],
    month: CLOSED_MONTH,
    method: 'cash',
    date: `${CLOSED_MONTH}-30`,
    revision,
    requestId: randomUUID(),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.paid, ['STF-1']);

  const state = await get('/api/state');
  const expense = state.state.expenses.find(item => item.id === `EXP-salariu-STF-1-${CLOSED_MONTH}`);
  assert.ok(expense);
  // Filiala reală seamănă categoria „Salarii” la pornire (expense-category-seeding.mjs) — m8
  // rezolvă după id, care aici există; cazul de cădere pe General e testat separat, la nivel
  // de serviciu, cu o categorie ștearsă/redenumită.
  assert.equal(expense.category, 'Salarii');
  assert.equal(expense.amount, 4400);
});

test('pay() refuză o lună care nu s-a încheiat (M4)', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-personal-pay-open-month-' });
  await setUpStaffAndSalary(get, post);
  await post('/api/personal/pin/unlock', { pin: '1234' });
  await post('/api/personal/salaries', {
    id: 'SAL-1',
    staffId: 'STF-1',
    mode: 'fix',
    amount: 4400,
    validFrom: '2025-01',
  });

  const revision = (await get('/api/state')).revision;
  // Ora locală, ca `today()` din server — `toISOString()` (UTC) alunecă luna în noaptea de 1.
  const currentMonth = today().slice(0, 7);
  const response = await post('/api/personal/salaries/pay', {
    staffIds: ['STF-1'],
    month: currentMonth,
    method: 'cash',
    date: today(),
    revision,
    requestId: randomUUID(),
  });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /Luna nu s-a încheiat/);
});

test('setarea salariului scrie în Istoric (M5)', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-personal-salary-audit-' });
  await setUpStaffAndSalary(get, post);
  await post('/api/personal/pin/unlock', { pin: '1234' });

  const response = await post('/api/personal/salaries', {
    id: 'SAL-1',
    staffId: 'STF-1',
    mode: 'fix',
    amount: 4400,
    validFrom: '2025-01',
  });
  assert.equal(response.status, 200);

  const history = await get('/api/audit');
  assert.ok(history.entries.some(entry => entry.action === 'personal: salariu'));
});

test('salariile, avansurile și plata refuză un angajat al altei filiale; nu se văd pe filiala activă (M5 + m9)', async t => {
  const { get, post, origin } = await startTestApplication(t, { prefix: 'startica-personal-salary-branch-' });
  const branchA = (await get('/api/session')).branch.id;
  const created = await post('/api/branches', { name: 'Botanica' });
  assert.equal(created.status, 200);
  const branchB = created.body.branch.id;

  await post('/api/personal/staff', {
    mode: 'create',
    staff: { id: 'STF-B', name: 'Ion Bejan', roleId: 'ROL-educator', branchIds: [branchB], since: '2025-01-01' },
  });
  await post('/api/personal/pin', { pin: '1234' });
  await post('/api/personal/pin/unlock', { pin: '1234' });

  // Filiala activă e încă A: STF-B nu lucrează aici — refuzat la salariu, avans și plată.
  assert.equal(
    (
      await post('/api/personal/salaries', {
        id: 'SAL-B',
        staffId: 'STF-B',
        mode: 'fix',
        amount: 3000,
        validFrom: '2025-01',
      })
    ).status,
    409,
  );
  let revision = (await get('/api/state')).revision;
  assert.equal(
    (
      await post('/api/personal/advances', {
        advance: { staffId: 'STF-B', date: `${CLOSED_MONTH}-05`, amount: 100, method: 'cash', month: CLOSED_MONTH },
        revision,
        requestId: randomUUID(),
      })
    ).status,
    409,
  );
  revision = (await get('/api/state')).revision;
  assert.equal(
    (
      await post('/api/personal/salaries/pay', {
        staffIds: ['STF-B'],
        month: CLOSED_MONTH,
        method: 'cash',
        date: `${CLOSED_MONTH}-30`,
        revision,
        requestId: randomUUID(),
      })
    ).status,
    409,
  );

  // Pe filiala lui (B), totul funcționează normal.
  await post('/api/branches/select', { id: branchB });
  const salaryOnB = await post('/api/personal/salaries', {
    id: 'SAL-B',
    staffId: 'STF-B',
    mode: 'fix',
    amount: 3000,
    validFrom: '2025-01',
  });
  assert.equal(salaryOnB.status, 200);
  revision = (await get('/api/state')).revision;
  const advanceOnB = await post('/api/personal/advances', {
    advance: { staffId: 'STF-B', date: `${CLOSED_MONTH}-05`, amount: 100, method: 'cash', month: CLOSED_MONTH },
    revision,
    requestId: randomUUID(),
  });
  assert.equal(advanceOnB.status, 200);

  // m9: înapoi pe A, nici avansul, nici istoricul lui STF-B nu se văd.
  await post('/api/branches/select', { id: branchA });
  const advancesOnA = await get(`/api/personal/advances?year=${CLOSED_MONTH.slice(0, 4)}`);
  assert.deepEqual(advancesOnA.advances, []);
  assert.equal((await getWithStatus(origin, '/api/personal/salaries/history?staffId=STF-B')).status, 400);
});
