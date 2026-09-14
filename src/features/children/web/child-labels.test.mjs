import test from 'node:test';
import assert from 'node:assert/strict';
import { statusBadgeClass } from './child-labels.mjs';

test('statusBadgeClass mapează statutul cunoscut, altfel cade pe partial', () => {
  assert.equal(statusBadgeClass('Activ'), 'active');
  assert.equal(statusBadgeClass('Suspendat'), 'partial');
  assert.equal(statusBadgeClass('Retras'), 'late');
  assert.equal(statusBadgeClass('De verificat'), 'partial');
});
