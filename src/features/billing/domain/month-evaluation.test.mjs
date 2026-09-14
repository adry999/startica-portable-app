import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateChildrenForMonth } from './month-evaluation.mjs';

/**
 * @param {Partial<import('#shared/contracts/record-types.mjs').Child>} overrides
 * @returns {import('#shared/contracts/record-types.mjs').Child}
 */
function baseChild(overrides = {}) {
  return {
    id: 'c1',
    name: 'Copil Test',
    parent: '',
    phone: '',
    groupId: null,
    status: 'Activ',
    statusHistory: [],
    attendanceDate: '2025-01-10',
    fee: null,
    feeHistory: [{ from: '2025-01', amount: 500 }],
    dueDay: 10,
    ...overrides,
  };
}

/** @param {Partial<import('#shared/contracts/record-types.mjs').Child>[]} children @param {any[]} payments */
const records = (children, payments) => /** @type {any} */ ({ children, payments });

test('evaluează toți copiii din instantaneu, arhivați inclusiv', () => {
  const rows = evaluateChildrenForMonth(
    records([baseChild({ id: 'c1' }), baseChild({ id: 'c2', archived: true })], []),
    '2025-02',
    '2025-02-05',
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map(r => r.child.id),
    ['c1', 'c2'],
  );
});

test('obligation ține cont de achitările existente, ca la un apel direct', () => {
  const payments = [{ id: 'p1', childId: 'c1', date: '2025-02-03', amount: 500, month: '2025-02', archived: false }];
  const [row] = evaluateChildrenForMonth(records([baseChild()], payments), '2025-02', '2025-02-05');
  assert.equal(row.obligation.expected, 500);
  assert.equal(row.obligation.paid, 500);
  assert.equal(row.obligation.rest, 0);
  assert.equal(row.obligation.label, 'Plătit');
});

test('asOf implicit este ziua curentă', () => {
  const rows = evaluateChildrenForMonth(records([baseChild()], []), '2025-02');
  assert.ok(rows[0].obligation.due);
});
