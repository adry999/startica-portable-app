import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startTestApplication } from '#test-support/start-test-application.mjs';

test('POST /api/payments-receipt-number asignează numărul și îl salvează pe achitare', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-receipt-number-' });

  await post('/api/kindergarten', { nextReceiptNumber: 10 });

  const created = await post('/api/record', {
    type: 'payments',
    mode: 'create',
    record: {
      id: 'PAY-1',
      date: '2026-09-15',
      amount: 3000,
      method: 'Cash',
      allocations: [{ month: '2026-09', amount: 3000 }],
    },
    revision: 0,
    requestId: randomUUID(),
  });
  assert.equal(created.status, 200);

  const response = await post('/api/payments-receipt-number', {
    paymentId: 'PAY-1',
    revision: created.body.revision,
    requestId: randomUUID(),
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.receiptNumber, 10);
  assert.equal(response.body.state.payments.find(p => p.id === 'PAY-1').receiptNumber, 10);

  const kindergarten = await get('/api/kindergarten');
  assert.equal(kindergarten.nextReceiptNumber, 11);
});

test('POST /api/payments-receipt-number retipărit nu trage un număr nou', async t => {
  const { post } = await startTestApplication(t, { prefix: 'startica-receipt-number-reprint-' });

  await post('/api/kindergarten', { nextReceiptNumber: 1 });
  const created = await post('/api/record', {
    type: 'payments',
    mode: 'create',
    record: {
      id: 'PAY-1',
      date: '2026-09-15',
      amount: 3000,
      method: 'Cash',
      allocations: [{ month: '2026-09', amount: 3000 }],
    },
    revision: 0,
    requestId: randomUUID(),
  });

  const first = await post('/api/payments-receipt-number', {
    paymentId: 'PAY-1',
    revision: created.body.revision,
    requestId: randomUUID(),
  });
  assert.equal(first.body.receiptNumber, 1);

  const second = await post('/api/payments-receipt-number', {
    paymentId: 'PAY-1',
    revision: first.body.revision,
    requestId: randomUUID(),
  });
  assert.equal(second.body.receiptNumber, 1);
});

test('POST /api/payments-receipt-number pe o achitare inexistentă respinge cererea', async t => {
  const { post } = await startTestApplication(t, { prefix: 'startica-receipt-number-missing-' });
  const response = await post('/api/payments-receipt-number', {
    paymentId: 'PAY-LIPSA',
    revision: 0,
    requestId: randomUUID(),
  });
  assert.equal(response.status, 409);
});
