import test from 'node:test';
import assert from 'node:assert/strict';
import { formatParentContacts, statusBadgeClass } from './child-labels.mjs';

/** @param {object} contacts */
const child = contacts => /** @type {any} */ ({ id: 'c1', name: 'Copil Test', ...contacts });

test('formatParentContacts combină ambii părinți cu telefoanele lor', () => {
  assert.equal(formatParentContacts(child({ parent: 'Maria', phone: '0722' })), 'Maria<br>0722');
  assert.equal(
    formatParentContacts(child({ parent: 'Maria', phone: '0722', parent2: 'Ion', phone2: '0733' })),
    'Maria<br>0722<br>Ion<br>0733',
  );
});

test('formatParentContacts arată necompletat sau numele lipsă', () => {
  assert.equal(formatParentContacts(child({})), 'Necompletat');
  assert.equal(formatParentContacts(child({ phone: '0722' })), 'Nume necompletat<br>0722');
});

test('statusBadgeClass mapează statutul cunoscut, altfel cade pe partial', () => {
  assert.equal(statusBadgeClass('Activ'), 'active');
  assert.equal(statusBadgeClass('Suspendat'), 'partial');
  assert.equal(statusBadgeClass('Retras'), 'late');
  assert.equal(statusBadgeClass('De verificat'), 'partial');
});
