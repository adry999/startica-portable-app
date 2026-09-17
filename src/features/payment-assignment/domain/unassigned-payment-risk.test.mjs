import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSIGNMENT_DAY, SEPTEMBER, createAssignmentRecords } from '../test-support/assignment-fixtures.mjs';
import { measureAssignmentRisk } from './unassigned-payment-risk.mjs';

test('coveringMonth și amountCoveringMonth numără doar achitările neasociate alocate lunii cerute', () => {
  const records = createAssignmentRecords();
  records.payments.push({
    ...records.payments[0],
    id: 'PAY-OCTOMBRIE',
    month: '2026-10',
    allocations: [{ month: '2026-10', amount: 1500 }],
  });

  const risk = measureAssignmentRisk(records, SEPTEMBER, ASSIGNMENT_DAY);

  assert.equal(risk.unassigned, 4);
  assert.equal(risk.coveringMonth, 3);
  assert.equal(risk.amountCoveringMonth, 4500);
});

test('o achitare arhivată fără copil nu intră în risc', () => {
  const records = createAssignmentRecords();
  records.payments.push({ ...records.payments[0], id: 'PAY-ARHIVATA', archived: true });

  const risk = measureAssignmentRisk(records, SEPTEMBER, ASSIGNMENT_DAY);

  assert.equal(risk.unassigned, 3);
});

test('notified numără copiii nearhivați cu rest de plată pentru luna cerută', () => {
  const records = createAssignmentRecords();
  records.children[2] = {
    ...records.children[2],
    attendanceDate: '2026-01-10',
    fee: 500,
    feeHistory: [{ from: '2026-01', amount: 500 }],
  };

  const risk = measureAssignmentRisk(records, SEPTEMBER, ASSIGNMENT_DAY);

  assert.equal(risk.notified, 1);
});
