import test from 'node:test';
import assert from 'node:assert/strict';
import { applyChildFeeSetup, hasMissingFee, defaultSetupMonth } from './child-fee-setup.mjs';

/**
 * @param {Partial<import('#shared/contracts/record-types.mjs').Child>} overrides
 * @returns {import('#shared/contracts/record-types.mjs').Child}
 */
function baseChild(overrides = {}) {
  return {
    id: 'CSV-1',
    name: 'Copil Test',
    parent: '',
    phone: '',
    groupId: null,
    status: 'De verificat',
    statusHistory: [],
    fee: null,
    feeHistory: [],
    dueDay: 10,
    ...overrides,
  };
}

test('scrie taxa și statutul în istoric pe luna indicată și actualizează valoarea curentă', () => {
  const updated = applyChildFeeSetup(baseChild(), { from: '2025-02', fee: 2000, status: 'Activ' });
  assert.equal(updated.fee, 2000);
  assert.deepEqual(updated.feeHistory, [{ from: '2025-02', amount: 2000, currency: 'MDL' }]);
  assert.equal(updated.status, 'Activ');
  assert.deepEqual(updated.statusHistory, [{ from: '2025-02', status: 'Activ' }]);
});

test('o a doua completare pe aceeași lună rescrie intrarea din istoric, nu o dublează', () => {
  const first = applyChildFeeSetup(baseChild(), { from: '2025-02', fee: 2000, status: 'Activ' });
  const second = applyChildFeeSetup(first, { from: '2025-02', fee: 3000, status: 'Suspendat' });
  assert.deepEqual(second.feeHistory, [{ from: '2025-02', amount: 3000, currency: 'MDL' }]);
  assert.deepEqual(second.statusHistory, [{ from: '2025-02', status: 'Suspendat' }]);
});

test('grupa se poate goli, seta la o valoare validă sau respinge dacă e invalidă', () => {
  const withGroup = applyChildFeeSetup(baseChild(), { from: '2025-02', groupId: 'GRP-mica' });
  assert.equal(withGroup.groupId, 'GRP-mica');

  const cleared = applyChildFeeSetup(withGroup, { from: '2025-02', groupId: null });
  assert.equal(cleared.groupId, null);

  assert.throws(() => applyChildFeeSetup(baseChild(), { from: '2025-02', groupId: '  ' }), /Grupă invalidă/);
});

test('respinge luna de aplicare invalidă', () => {
  assert.throws(() => applyChildFeeSetup(baseChild(), { from: '2025-13' }), /luna de aplicare este invalidă/);
});

test('respinge statutul invalid', () => {
  assert.throws(() => applyChildFeeSetup(baseChild(), { from: '2025-02', status: 'Oricare' }), /statut invalid/);
});

test('câmpurile netrimise rămân neschimbate', () => {
  const withValues = applyChildFeeSetup(baseChild(), {
    from: '2025-02',
    fee: 2000,
    groupId: 'GRP-mica',
    status: 'Activ',
  });
  const untouched = applyChildFeeSetup(withValues, { from: '2025-03' });
  assert.equal(untouched.fee, 2000);
  assert.equal(untouched.groupId, 'GRP-mica');
  assert.equal(untouched.status, 'Activ');
  assert.deepEqual(untouched.feeHistory, [{ from: '2025-02', amount: 2000, currency: 'MDL' }]);
  assert.deepEqual(untouched.statusHistory, [{ from: '2025-02', status: 'Activ' }]);
});

test('hasMissingFee este adevărat doar când istoricul taxei este gol', () => {
  assert.equal(hasMissingFee(baseChild()), true);
  assert.equal(hasMissingFee(baseChild({ feeHistory: [{ from: '2025-02', amount: 2000 }] })), false);
});

test('defaultSetupMonth alege începerea frecventării, apoi contractul, apoi ziua curentă', () => {
  const today = '2026-09-13';
  assert.equal(
    defaultSetupMonth(baseChild({ attendanceDate: '2025-02-03', contractDate: '2025-01-14' }), today),
    '2025-02',
  );
  assert.equal(defaultSetupMonth(baseChild({ contractDate: '2025-01-14' }), today), '2025-01');
  assert.equal(defaultSetupMonth(baseChild(), today), '2026-09');
});
