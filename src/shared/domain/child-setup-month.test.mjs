import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSetupMonth } from './child-setup-month.mjs';

test('defaultSetupMonth alege începerea frecventării, apoi contractul, apoi ziua curentă', () => {
  const today = '2026-09-13';
  assert.equal(defaultSetupMonth({ attendanceDate: '2025-02-03', contractDate: '2025-01-14' }, today), '2025-02');
  assert.equal(defaultSetupMonth({ contractDate: '2025-01-14' }, today), '2025-01');
  assert.equal(defaultSetupMonth({}, today), '2026-09');
});
