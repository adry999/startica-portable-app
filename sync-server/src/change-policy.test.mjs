import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFLICT_KINDS, isLastWriterWins, KINDS } from './change-policy.mjs';

test('fișele, grupele, categoriile și vizitele intră în conflict, restul sunt last-writer-wins', () => {
  for (const kind of CONFLICT_KINDS) assert.equal(isLastWriterWins(kind), false, kind);
  for (const kind of KINDS.filter(k => !CONFLICT_KINDS.includes(k))) assert.equal(isLastWriterWins(kind), true, kind);
});

test('KINDS conține toate tipurile de fișe plus prezența, tabelele Bazinului, setul comun, șabloanele SMS și setările', () => {
  assert.deepEqual(KINDS, [
    'children',
    'payments',
    'expenses',
    'groups',
    'categories',
    'visits',
    'charges',
    'attendance',
    'pool_bookings',
    'pool_sessions',
    'pool_closings',
    'staff',
    'departments',
    'roles',
    'timesheet',
    'leaves',
    'salaries',
    'advances',
    'salary_payments',
    'sms_templates',
    'settings',
  ]);
});
