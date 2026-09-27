import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePersonalRecord, nextTimesheetCode, isStaffInBranch, worksAtAllBranches } from './personal-schema.mjs';

test('normalizePersonalRecord refuză un rol fără departament și un angajat fără filială', () => {
  assert.throws(() => normalizePersonalRecord('roles', { id: 'ROL-1', name: 'Educator' }), /Departament/);
  assert.throws(
    () =>
      normalizePersonalRecord('staff', {
        id: 'STF-1',
        name: 'Ana',
        roleId: 'ROL-1',
        branchIds: [],
        since: '2026-01-01',
      }),
    /filial/,
  );
  const staff = normalizePersonalRecord('staff', {
    id: 'STF-1',
    name: '  Ana  ',
    roleId: 'ROL-1',
    branchIds: ['bu'],
    since: '2026-01-01',
  });
  assert.equal(staff.name, 'Ana');
  assert.deepEqual(staff.notes, []);
  assert.equal(staff.archivedAt, null);
});

test('normalizePersonalRecord respinge id-uri cu prefixul greșit', () => {
  assert.throws(() => normalizePersonalRecord('departments', { id: 'ROL-1', name: 'Educatori' }), /ID invalid/);
  assert.doesNotThrow(() => normalizePersonalRecord('departments', { id: 'DEP-1', name: 'Educatori' }));
});

test('normalizePersonalRecord validează pontajul și concediile', () => {
  assert.throws(
    () => normalizePersonalRecord('timesheet', { id: 'TS-1', staffId: 'STF-1', date: '2026-09-08', code: 'X' }),
    /Cod invalid/,
  );
  assert.throws(
    () =>
      normalizePersonalRecord('leaves', {
        id: 'LV-1',
        staffId: 'STF-1',
        from: '2026-07-27',
        to: '2026-07-06',
        type: 'CO',
        planned: false,
      }),
    /Perioada/,
  );
  const leave = normalizePersonalRecord('leaves', {
    id: 'LV-1',
    staffId: 'STF-1',
    from: '2026-07-06',
    to: '2026-07-27',
    type: 'CO',
    planned: true,
  });
  assert.equal(leave.planned, true);
});

test('nextTimesheetCode ciclează gol → CO → CM → A → gol', () => {
  assert.equal(nextTimesheetCode(''), 'CO');
  assert.equal(nextTimesheetCode('CO'), 'CM');
  assert.equal(nextTimesheetCode('CM'), 'A');
  assert.equal(nextTimesheetCode('A'), null);
  assert.equal(nextTimesheetCode(null), 'CO');
});

test('isStaffInBranch și worksAtAllBranches filtrează pe filiala activă', () => {
  const staff = { branchIds: ['bu'] };
  const both = { branchIds: ['bu', 'bo'] };
  assert.equal(isStaffInBranch(staff, 'bu'), true);
  assert.equal(isStaffInBranch(staff, 'bo'), false);
  assert.equal(worksAtAllBranches(staff, ['bu', 'bo']), false);
  assert.equal(worksAtAllBranches(both, ['bu', 'bo']), true);
});
