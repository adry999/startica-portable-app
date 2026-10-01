import test from 'node:test';
import assert from 'node:assert/strict';
import { schoolYearStartOf, schoolYearMonths, schoolYearLabel, schoolYearDayBounds } from './school-year.mjs';

test('schoolYearStartOf: septembrie deschide anul școlar, august îl închide', () => {
  assert.equal(schoolYearStartOf('2026-09'), 2026);
  assert.equal(schoolYearStartOf('2027-08'), 2026);
  assert.equal(schoolYearStartOf('2026-08'), 2025);
});

test('schoolYearMonths: 12 luni, din septembrie în august, cu trecerea de an', () => {
  const months = schoolYearMonths(2026);
  assert.equal(months.length, 12);
  assert.equal(months[0], '2026-09');
  assert.equal(months[3], '2026-12');
  assert.equal(months[4], '2027-01');
  assert.equal(months[11], '2027-08');
});

test('schoolYearLabel folosește linia de dialog, ca în antetul din spec', () => {
  assert.equal(schoolYearLabel(2025), 'Anul școlar 2025–2026');
});

test('schoolYearDayBounds: 1 septembrie – 31 august, cu trecerea de an', () => {
  assert.deepEqual(schoolYearDayBounds(2026), { from: '2026-09-01', to: '2027-08-31' });
});
