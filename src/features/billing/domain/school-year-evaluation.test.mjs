import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { schoolYearMonths, evaluateChildrenForSchoolYear } from './school-year-evaluation.mjs';

// Testele lui schoolYearStartOf/schoolYearMonths/schoolYearLabel stau acum în
// `#shared/domain/school-year.test.mjs`, lângă sursa lor unică.

const child = (overrides = {}) =>
  normalizeRecord('children', {
    id: 'C-1',
    name: 'Copil Test',
    status: 'Activ',
    attendanceDate: '2026-01-10',
    feeHistory: [{ from: '2026-01', amount: 1000 }],
    ...overrides,
  });

test('evaluateChildrenForSchoolYear întoarce 12 obligații per copil, în ordinea lunilor', () => {
  const records = /** @type {any} */ ({ children: [child()], payments: [] });
  const [row] = evaluateChildrenForSchoolYear(records, 2026, '2026-09-27');
  assert.equal(row.child.id, 'C-1');
  assert.deepEqual(
    row.months.map(m => m.month),
    schoolYearMonths(2026),
  );
  assert.equal(row.months[0].obligation.expected, 1000);
});

test('evaluateChildrenForSchoolYear vede achitările la luna lor și ignoră plățile de după asOf', () => {
  const payments = [
    normalizeRecord('payments', {
      id: 'P-1',
      childId: 'C-1',
      date: '2026-10-05',
      amount: 1000,
      method: 'Cash',
      allocations: [{ month: '2026-10', amount: 1000 }],
    }),
    normalizeRecord('payments', {
      id: 'P-2',
      childId: 'C-1',
      date: '2026-12-01',
      amount: 1000,
      method: 'Cash',
      allocations: [{ month: '2026-11', amount: 1000 }],
    }),
  ];
  const records = /** @type {any} */ ({ children: [child()], payments });
  const [row] = evaluateChildrenForSchoolYear(records, 2026, '2026-11-15');
  assert.equal(row.months[1].obligation.label, 'Plătit'); // 2026-10
  assert.equal(row.months[2].obligation.paid, 0); // 2026-11: plata din decembrie e după asOf
});

test('evaluateChildrenForSchoolYear include toți copiii, arhivați inclusiv', () => {
  const records = /** @type {any} */ ({ children: [child(), child({ id: 'C-2', archived: true })], payments: [] });
  assert.deepEqual(
    evaluateChildrenForSchoolYear(records, 2026, '2026-09-27').map(r => r.child.id),
    ['C-1', 'C-2'],
  );
});
