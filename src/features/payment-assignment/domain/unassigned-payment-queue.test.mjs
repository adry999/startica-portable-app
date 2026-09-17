import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssignmentRecords } from '../test-support/assignment-fixtures.mjs';
import { listUnassignedPayments } from './unassigned-payment-queue.mjs';

test('include doar achitările fără copil și nearhivate, nu și pe cea deja asociată', () => {
  const records = createAssignmentRecords();

  const result = listUnassignedPayments(records);

  assert.deepEqual(new Set(result.map(entry => entry.payment.id)), new Set(['PAY-MIHAI', 'PAY-POP', 'PAY-BLANK']));
});

test('o achitare arhivată fără copil nu intră în coadă', () => {
  const records = createAssignmentRecords();
  records.payments.push({ ...records.payments[0], id: 'PAY-ARHIVATA', archived: true });

  const result = listUnassignedPayments(records);

  assert.ok(!result.some(entry => entry.payment.id === 'PAY-ARHIVATA'));
});

test('cele mai recente achitări apar primele', () => {
  const records = createAssignmentRecords();
  records.payments = [
    { ...records.payments[0], id: 'PAY-VECHE', date: '2026-08-01' },
    { ...records.payments[0], id: 'PAY-NOUA', date: '2026-09-10' },
  ];

  const result = listUnassignedPayments(records);

  assert.deepEqual(
    result.map(entry => entry.payment.id),
    ['PAY-NOUA', 'PAY-VECHE'],
  );
});

test('limit reduce numărul de achitări întoarse', () => {
  const records = createAssignmentRecords();

  const result = listUnassignedPayments(records, 1);

  assert.equal(result.length, 1);
});

test('suggestions vin din suggestChildren: un nume unic indică un singur copil, unul ambiguu mai mulți', () => {
  const records = createAssignmentRecords();

  const result = listUnassignedPayments(records);
  const suggestionIdsByPaymentId = Object.fromEntries(
    result.map(entry => [entry.payment.id, entry.suggestions.map(suggestion => suggestion.id)]),
  );

  assert.deepEqual(suggestionIdsByPaymentId['PAY-MIHAI'], ['CHILD-MIHAI']);
  assert.deepEqual(new Set(suggestionIdsByPaymentId['PAY-POP']), new Set(['CHILD-ANA', 'CHILD-IOANA']));
  assert.deepEqual(suggestionIdsByPaymentId['PAY-BLANK'], []);
});
