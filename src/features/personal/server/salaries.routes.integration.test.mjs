import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startTestApplication } from '#test-support/start-test-application.mjs';

/** @param {string} branchId */
const staffInput = branchId => ({
  id: 'STF-1',
  name: 'Ana Popescu',
  roleId: 'ROL-educator',
  branchIds: [branchId],
  since: '2026-01-01',
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

  assert.equal((await getWithStatus(origin, '/api/personal/salaries?month=2026-09')).status, 403);
  assert.equal((await getWithStatus(origin, '/api/personal/advances?year=2026')).status, 403);
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
    validFrom: '2026-01',
  });
  assert.equal(response.status, 200);

  const salaries = await get('/api/personal/salaries?month=2026-09');
  assert.equal(salaries.rows.length, 1);
  assert.equal(salaries.rows[0].gross, 4400);

  response = await post('/api/personal/pin/lock', {});
  assert.equal(response.status, 200);
  assert.equal((await getWithStatus(origin, '/api/personal/salaries?month=2026-09')).status, 403);
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
    validFrom: '2026-01',
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
    validFrom: '2026-01',
  });

  const revision = (await get('/api/state')).revision;
  const response = await post('/api/personal/salaries/pay', {
    staffIds: ['STF-1'],
    month: '2026-09',
    method: 'cash',
    date: '2026-09-30',
    revision,
    requestId: randomUUID(),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.paid, ['STF-1']);

  const state = await get('/api/state');
  const expense = state.state.expenses.find(item => item.id === 'EXP-salariu-STF-1-2026-09');
  assert.ok(expense);
  assert.equal(expense.category, 'Salarii');
  assert.equal(expense.amount, 4400);
});
