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

test('normalizePersonalRecord validează data nașterii, IDNP și adresa angajatului', () => {
  const base = { id: 'STF-1', name: 'Ana', roleId: 'ROL-1', branchIds: ['bu'], since: '2026-01-01' };
  assert.throws(() => normalizePersonalRecord('staff', { ...base, birth: '2026-13-40' }), /nașterii/);
  assert.throws(() => normalizePersonalRecord('staff', { ...base, idnp: 12345 }), /IDNP/);
  assert.throws(() => normalizePersonalRecord('staff', { ...base, address: ['nu e text'] }), /Adresa/);
  const staff = normalizePersonalRecord('staff', {
    ...base,
    birth: '1990-05-20',
    idnp: '2000000000000',
    address: 'Str. X',
  });
  assert.equal(staff.birth, '1990-05-20');
  assert.equal(staff.idnp, '2000000000000');
  assert.equal(staff.address, 'Str. X');
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

test('normalizePersonalRecord validează un candidat (23l) — nume obligatoriu, vârstă opțională', () => {
  assert.throws(
    () =>
      normalizePersonalRecord('candidates', {
        id: 'CAN-1',
        name: '',
        createdAt: '2026-09-28T10:00:00.000Z',
        updatedAt: '2026-09-28T10:00:00.000Z',
      }),
    /Nume/,
  );
  assert.throws(
    () =>
      normalizePersonalRecord('candidates', {
        id: 'CAN-1',
        name: 'Ana',
        age: -1,
        createdAt: '2026-09-28T10:00:00.000Z',
        updatedAt: '2026-09-28T10:00:00.000Z',
      }),
    /Vârsta/,
  );
  const candidate = normalizePersonalRecord('candidates', {
    id: 'CAN-1',
    name: '  Ana Popescu  ',
    position: 'Educator',
    createdAt: '2026-09-28T10:00:00.000Z',
    updatedAt: '2026-09-28T10:00:00.000Z',
  });
  assert.equal(candidate.name, 'Ana Popescu');
  assert.equal(candidate.age, null);
  assert.equal(candidate.experience, '');
  assert.equal(candidate.city, '');
  assert.equal(candidate.phone, '');
  assert.equal(candidate.notes, '');
});

test('§10: normalizePersonalRecord normalizează telefonul angajatului la E.164', () => {
  const base = { id: 'STF-1', name: 'Ana', roleId: 'ROL-1', branchIds: ['bu'], since: '2026-01-01' };
  const staff = normalizePersonalRecord('staff', { ...base, phone: '069123456' });
  assert.equal(staff.phone, '+37369123456');
  assert.ok(!('phoneInvalid' in staff));
});

test('§10: un „alt număr” cu „+” se acceptă cum a fost scris, pentru angajat și candidat', () => {
  const base = { id: 'STF-1', name: 'Ana', roleId: 'ROL-1', branchIds: ['bu'], since: '2026-01-01' };
  const staff = normalizePersonalRecord('staff', { ...base, phone: '+40 721 000 000' });
  assert.equal(staff.phone, '+40 721 000 000');
  assert.ok(!('phoneInvalid' in staff));

  const candidate = normalizePersonalRecord('candidates', {
    id: 'CAN-1',
    name: 'Ana',
    phone: '+40 721 000 000',
    createdAt: '2026-09-28T10:00:00.000Z',
    updatedAt: '2026-09-28T10:00:00.000Z',
  });
  assert.equal(candidate.phone, '+40 721 000 000');
  assert.ok(!('phoneInvalid' in candidate));
});

test('§10: un telefon invalid rămâne cum a fost scris, cu phoneInvalid: true, pentru angajat și candidat', () => {
  const base = { id: 'STF-1', name: 'Ana', roleId: 'ROL-1', branchIds: ['bu'], since: '2026-01-01' };
  const staff = normalizePersonalRecord('staff', { ...base, phone: '123' });
  assert.equal(staff.phone, '123');
  assert.equal(staff.phoneInvalid, true);

  const candidate = normalizePersonalRecord('candidates', {
    id: 'CAN-1',
    name: 'Ana',
    phone: '123',
    createdAt: '2026-09-28T10:00:00.000Z',
    updatedAt: '2026-09-28T10:00:00.000Z',
  });
  assert.equal(candidate.phone, '123');
  assert.equal(candidate.phoneInvalid, true);
});
