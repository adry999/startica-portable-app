import test from 'node:test';
import assert from 'node:assert/strict';
import {
  leaveWorkingDays,
  leaveDaysRemaining,
  timesheetRowsForLeave,
  overlappingLeavesInGroup,
} from './leave-days.mjs';
import { fixtureLeave } from '../test-support/personal-fixtures.mjs';

test('un concediu CO de 6–27 iulie consumă 16 zile lucrătoare și rămân 12 din 28', () => {
  const leave = fixtureLeave({ from: '2026-07-06', to: '2026-07-27' });
  assert.equal(leaveWorkingDays(leave).length, 16);

  const remaining = leaveDaysRemaining({
    staffId: 'STF-1',
    year: '2026',
    leaves: [leave],
    annualLeaveDays: 28,
  });
  assert.deepEqual(remaining, { used: 16, planned: 0, remaining: 12 });
});

test('un concediu planificat scade din zilele rămase la fel ca unul deja luat', () => {
  const taken = fixtureLeave({ from: '2026-07-06', to: '2026-07-17' });
  const planned = fixtureLeave({ id: 'LV-2', from: '2026-12-07', to: '2026-12-11', planned: true });
  const remaining = leaveDaysRemaining({
    staffId: 'STF-1',
    year: '2026',
    leaves: [taken, planned],
    annualLeaveDays: 28,
  });
  assert.equal(remaining.used, leaveWorkingDays(taken).length);
  assert.equal(remaining.planned, leaveWorkingDays(planned).length);
  assert.equal(remaining.remaining, 28 - remaining.used - remaining.planned);
});

test('timesheetRowsForLeave scrie codul concediului pe fiecare zi lucrătoare a perioadei', () => {
  const leave = fixtureLeave({ from: '2026-09-07', to: '2026-09-11', type: 'CM' });
  const rows = timesheetRowsForLeave(leave);
  assert.equal(rows.length, 5);
  assert.ok(rows.every(row => row.code === 'CM' && row.leaveId === 'LV-1' && row.staffId === 'STF-1'));
});

test('două concedii suprapuse în aceeași grupă sunt raportate o singură dată', () => {
  const groups = [{ id: 'GRP-1', team: [{ staffId: 'STF-1' }, { staffId: 'STF-2' }] }];
  const leaves = [
    fixtureLeave({ staffId: 'STF-1', from: '2026-09-07', to: '2026-09-11' }),
    fixtureLeave({ id: 'LV-2', staffId: 'STF-2', from: '2026-09-09', to: '2026-09-15', type: 'CM' }),
  ];
  const warnings = overlappingLeavesInGroup(leaves, groups);
  assert.equal(warnings.length, 1);
  assert.deepEqual(warnings[0], {
    groupId: 'GRP-1',
    staffIds: ['STF-1', 'STF-2'],
    from: '2026-09-09',
    to: '2026-09-11',
  });
});

test('concedii ale unor angajați din grupe diferite nu se raportează', () => {
  const groups = [
    { id: 'GRP-1', team: [{ staffId: 'STF-1' }] },
    { id: 'GRP-2', team: [{ staffId: 'STF-2' }] },
  ];
  const leaves = [
    fixtureLeave({ staffId: 'STF-1', from: '2026-09-07', to: '2026-09-11' }),
    fixtureLeave({ id: 'LV-2', staffId: 'STF-2', from: '2026-09-09', to: '2026-09-15', type: 'CM' }),
  ];
  assert.deepEqual(overlappingLeavesInGroup(leaves, groups), []);
});
