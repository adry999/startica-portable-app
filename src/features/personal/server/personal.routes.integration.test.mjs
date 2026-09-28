import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestApplication } from '#test-support/start-test-application.mjs';

/** @param {string} branchId @param {Partial<{ id: string, name: string, roleId: string, branchIds: string[], since: string }>} [overrides] */
const staffInput = (branchId, overrides = {}) => ({
  id: 'STF-1',
  name: 'Ana Popescu',
  roleId: 'ROL-educator',
  branchIds: [branchId],
  since: '2026-01-01',
  ...overrides,
});

test('echipa filialei active conține doar angajații ei; cei cu ambele filiale apar în amândouă', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-personal-' });

  const initialSession = await get('/api/session');
  const branchA = initialSession.branch.id;
  const created = await post('/api/branches', { name: 'Botanica' });
  assert.equal(created.status, 200);
  const branchB = created.body.branch.id;

  let response = await post('/api/personal/staff', {
    mode: 'create',
    staff: staffInput(branchA, { id: 'STF-A' }),
  });
  assert.equal(response.status, 200);
  response = await post('/api/personal/staff', {
    mode: 'create',
    staff: staffInput(branchA, { id: 'STF-BOTH', branchIds: [branchA, branchB] }),
  });
  assert.equal(response.status, 200);

  let state = await get('/api/personal/state');
  assert.deepEqual(state.staff.map(staff => staff.id).sort(), ['STF-A', 'STF-BOTH']);

  await post('/api/branches/select', { id: branchB });
  state = await get('/api/personal/state');
  assert.deepEqual(
    state.staff.map(staff => staff.id),
    ['STF-BOTH'],
  );

  response = await post('/api/personal/staff', {
    mode: 'create',
    staff: staffInput(branchB, { id: 'STF-B' }),
  });
  assert.equal(response.status, 200);
  state = await get('/api/personal/state');
  assert.deepEqual(state.staff.map(staff => staff.id).sort(), ['STF-B', 'STF-BOTH']);

  await post('/api/branches/select', { id: branchA });
  state = await get('/api/personal/state');
  assert.deepEqual(state.staff.map(staff => staff.id).sort(), ['STF-A', 'STF-BOTH']);
});

test('un concediu CO scrie CO în pontaj pe zilele lucrătoare, iar ștergerea lui le scoate', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-personal-leave-' });
  const branchId = (await get('/api/session')).branch.id;

  await post('/api/personal/staff', { mode: 'create', staff: staffInput(branchId) });
  let response = await post('/api/personal/leaves', {
    leave: { id: 'LV-1', staffId: 'STF-1', from: '2026-09-07', to: '2026-09-11', type: 'CO', planned: false },
  });
  assert.equal(response.status, 200);

  let timesheet = await get('/api/personal/timesheet?month=2026-09');
  assert.equal(timesheet.rows.length, 5);
  assert.ok(timesheet.rows.every(row => row.code === 'CO' && row.leaveId === 'LV-1'));

  response = await post('/api/personal/leaves', { id: 'LV-1', remove: true });
  assert.equal(response.status, 200);
  timesheet = await get('/api/personal/timesheet?month=2026-09');
  assert.deepEqual(timesheet.rows, []);
});

test('pontajul acceptă schimbări de tură, iar state-ul personalului nu conține sume', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-personal-timesheet-' });
  const branchId = (await get('/api/session')).branch.id;
  await post('/api/personal/staff', { mode: 'create', staff: staffInput(branchId) });

  let response = await post('/api/personal/timesheet', {
    changes: [{ staffId: 'STF-1', date: '2026-09-08', code: 'CM' }],
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.rows[0].code, 'CM');

  const state = await get('/api/personal/state');
  assert.deepEqual(Object.keys(state).sort(), ['departments', 'roles', 'settings', 'staff']);
  assert.equal(JSON.stringify(state).includes('amount'), false);
});

test('staff-archive fără o dată validă e refuzat, nu dez-arhivează în tăcere (m4)', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-personal-archive-' });
  const branchId = (await get('/api/session')).branch.id;
  await post('/api/personal/staff', { mode: 'create', staff: staffInput(branchId) });

  const missingDate = await post('/api/personal/staff-archive', { id: 'STF-1' });
  assert.equal(missingDate.status, 400);

  const invalidDate = await post('/api/personal/staff-archive', { id: 'STF-1', archivedAt: '2026-13-40' });
  assert.equal(invalidDate.status, 400);

  const beforeHire = await post('/api/personal/staff-archive', { id: 'STF-1', archivedAt: '2025-12-31' });
  assert.equal(beforeHire.status, 400);

  const state = await get('/api/personal/state');
  assert.equal(state.staff[0].archivedAt, null, 'angajatul rămâne activ după cereri refuzate');

  const ok = await post('/api/personal/staff-archive', { id: 'STF-1', archivedAt: '2026-09-27' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.staff.archivedAt, '2026-09-27');
});

test('un concediu pentru un angajat inexistent sau din altă filială e refuzat (m10)', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-personal-leave-branch-' });
  const created = await post('/api/branches', { name: 'Botanica' });
  const branchB = created.body.branch.id;
  await post('/api/personal/staff', { mode: 'create', staff: staffInput(branchB, { id: 'STF-B' }) });

  const unknownStaff = await post('/api/personal/leaves', {
    leave: { id: 'LV-1', staffId: 'STF-inexistent', from: '2026-09-07', to: '2026-09-11', type: 'CO', planned: false },
  });
  assert.equal(unknownStaff.status, 400);

  // suntem încă pe filiala A; STF-B e al filialei B
  const otherBranchStaff = await post('/api/personal/leaves', {
    leave: { id: 'LV-2', staffId: 'STF-B', from: '2026-09-07', to: '2026-09-11', type: 'CO', planned: false },
  });
  assert.equal(otherBranchStaff.status, 400);

  const timesheet = await get('/api/personal/timesheet?month=2026-09');
  assert.deepEqual(timesheet.rows, [], 'niciun rând orfan nu a fost scris');
});

test('o funcție cu angajați nu se poate șterge din 23e; angajat inexistent la pontaj e refuzat', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-personal-roles-' });
  const branchId = (await get('/api/session')).branch.id;
  await post('/api/personal/staff', { mode: 'create', staff: staffInput(branchId) });

  const state = await get('/api/personal/state');
  const remainingRoles = state.roles.filter(role => role.id !== 'ROL-educator');
  let response = await post('/api/personal/roles', { departments: state.departments, roles: remainingRoles });
  assert.equal(response.status, 400);

  response = await post('/api/personal/timesheet', {
    changes: [{ staffId: 'STF-inexistent', date: '2026-09-08', code: 'CO' }],
  });
  assert.equal(response.status, 400);
});
