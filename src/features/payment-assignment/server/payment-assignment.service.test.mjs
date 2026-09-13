import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryRecordRepository } from '#test-support/in-memory-record-repository.mjs';
import { createRecordingAuditTrail } from '#test-support/recording-audit-trail.mjs';
import { createImmediateRevisionTransaction } from '#test-support/immediate-revision-transaction.mjs';
import { createAssignmentRecords } from '../test-support/assignment-fixtures.mjs';
import { createPaymentAssignmentService } from './payment-assignment.service.mjs';

function createHarness() {
  const recordRepository = createInMemoryRecordRepository(createAssignmentRecords());
  const auditTrail = createRecordingAuditTrail();
  const transaction = createImmediateRevisionTransaction(recordRepository);
  const service = createPaymentAssignmentService({
    recordRepository,
    auditTrail,
    runRevisionTransaction: transaction.run,
  });
  /** @param {string} paymentId */
  const storedPayment = paymentId => {
    const payment = recordRepository.find('payments', paymentId);
    assert.ok(payment, `Achitarea ${paymentId} lipsește din fixture.`);
    return payment;
  };
  return { service, auditTrail, transaction, storedPayment };
}

const assignRequest = assignments => ({ assignments, revision: 7, requestId: 'assign-request-0001' });

test('asociază achitarea, păstrează restul câmpurilor și o trece în istoric', () => {
  const { service, auditTrail, transaction, storedPayment } = createHarness();
  const unassigned = storedPayment('PAY-MIHAI');

  service.assignPaymentsToChildren(assignRequest([{ id: 'PAY-MIHAI', childId: 'CHILD-MIHAI' }]));

  const assigned = storedPayment('PAY-MIHAI');
  assert.deepEqual(assigned, { ...unassigned, childId: 'CHILD-MIHAI' });
  assert.deepEqual(
    transaction.calls.map(call => call.options),
    [{ action: 'asociere-achitari', backupBefore: true }],
  );
  assert.deepEqual(auditTrail.changes, [
    { action: 'asociere achitare', recordType: 'payments', recordId: 'PAY-MIHAI', before: unassigned, after: assigned },
  ]);
});

test('refuză înainte de tranzacție o listă goală, prea mare sau incompletă', () => {
  const { service, transaction } = createHarness();
  const tooManyAssignments = Array.from({ length: 5001 }, (_, index) => ({ id: `PAY-${index}`, childId: 'CHILD-ANA' }));

  for (const assignments of [
    undefined,
    [],
    tooManyAssignments,
    [{ id: 'PAY-MIHAI' }],
    [{ id: 'PAY-MIHAI', childId: '' }],
  ])
    assert.throws(() => service.assignPaymentsToChildren(assignRequest(assignments)), { status: 400 });
  assert.equal(transaction.calls.length, 0);
});

test('refuză aceeași achitare de două ori în aceeași cerere', () => {
  const { service } = createHarness();

  assert.throws(
    () =>
      service.assignPaymentsToChildren(
        assignRequest([
          { id: 'PAY-POP', childId: 'CHILD-ANA' },
          { id: 'PAY-POP', childId: 'CHILD-IOANA' },
        ]),
      ),
    { status: 400, message: /apare de două ori/ },
  );
});

test('nu schimbă copilul unei achitări deja asociate', () => {
  const { service, auditTrail, storedPayment } = createHarness();

  assert.throws(
    () => service.assignPaymentsToChildren(assignRequest([{ id: 'PAY-ASSIGNED', childId: 'CHILD-IOANA' }])),
    { status: 409, message: /are deja un copil asociat/ },
  );
  assert.equal(storedPayment('PAY-ASSIGNED').childId, 'CHILD-ANA');
  assert.equal(auditTrail.changes.length, 0);
});

test('refuză o achitare ștearsă între timp și un copil inexistent', () => {
  const { service } = createHarness();

  assert.throws(() => service.assignPaymentsToChildren(assignRequest([{ id: 'PAY-DELETED', childId: 'CHILD-ANA' }])), {
    status: 409,
    message: /nu mai există/,
  });
  assert.throws(() => service.assignPaymentsToChildren(assignRequest([{ id: 'PAY-POP', childId: 'CHILD-UNKNOWN' }])), {
    status: 400,
    message: /Copilul CHILD-UNKNOWN nu există/,
  });
});
