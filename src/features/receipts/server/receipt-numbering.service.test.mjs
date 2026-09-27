import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryRecordRepository } from '#test-support/in-memory-record-repository.mjs';
import { createRecordingAuditTrail } from '#test-support/recording-audit-trail.mjs';
import { createImmediateRevisionTransaction } from '#test-support/immediate-revision-transaction.mjs';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { createReceiptNumberingService } from './receipt-numbering.service.mjs';

/** @param {Record<string, string>} [initial] */
function createInMemorySettings(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    readSetting: key => store.get(key) ?? '',
    writeSetting: (key, value) => store.set(key, value),
  };
}

/** @param {{ kindergarten?: Record<string, unknown> }} [options] */
function createHarness({ kindergarten } = {}) {
  const recordRepository = createInMemoryRecordRepository({
    payments: [
      normalizeRecord('payments', {
        id: 'PAY-1',
        date: '2026-09-15',
        amount: 3000,
        method: 'Cash',
        allocations: [{ month: '2026-09', amount: 3000 }],
      }),
      normalizeRecord('payments', {
        id: 'PAY-NUMEROTAT',
        date: '2026-09-01',
        amount: 1500,
        method: 'Cash',
        receiptNumber: 41,
        allocations: [{ month: '2026-09', amount: 1500 }],
      }),
    ],
  });
  const auditTrail = createRecordingAuditTrail();
  const transaction = createImmediateRevisionTransaction(recordRepository);
  const settings = createInMemorySettings(kindergarten ? { kindergarten: JSON.stringify(kindergarten) } : {});
  const service = createReceiptNumberingService({
    recordRepository,
    auditTrail,
    runRevisionTransaction: transaction.run,
    readSetting: settings.readSetting,
    writeSetting: settings.writeSetting,
  });
  /** @param {string} paymentId */
  const storedPayment = paymentId => {
    const payment = recordRepository.find('payments', paymentId);
    assert.ok(payment, `Achitarea ${paymentId} lipsește din fixture.`);
    return payment;
  };
  return { service, auditTrail, transaction, settings, storedPayment };
}

const assignRequest = paymentId => ({ paymentId, revision: 0, requestId: 'numerotare-cerere-0001' });

test('asignează numărul curent al grădiniței și crește contorul', () => {
  const { service, storedPayment, settings } = createHarness({ kindergarten: { nextReceiptNumber: 42 } });

  const result = service.assignReceiptNumber(assignRequest('PAY-1'));

  assert.equal(result.receiptNumber, 42);
  assert.equal(storedPayment('PAY-1').receiptNumber, 42);
  assert.equal(JSON.parse(settings.readSetting('kindergarten')).nextReceiptNumber, 43);
});

test('fără nicio setare salvată, contorul implicit e 1', () => {
  const { service } = createHarness();
  const result = service.assignReceiptNumber(assignRequest('PAY-1'));
  assert.equal(result.receiptNumber, 1);
});

test('trece asignarea în istoric', () => {
  const { service, auditTrail, storedPayment } = createHarness({ kindergarten: { nextReceiptNumber: 5 } });
  const before = storedPayment('PAY-1');

  service.assignReceiptNumber(assignRequest('PAY-1'));

  const after = storedPayment('PAY-1');
  assert.deepEqual(auditTrail.changes, [
    { action: 'numerotare confirmare de plată', recordType: 'payments', recordId: 'PAY-1', before, after },
  ]);
});

test('o achitare deja numerotată nu se reasignează, nici la retipărire', () => {
  const { service, storedPayment, settings } = createHarness({ kindergarten: { nextReceiptNumber: 100 } });

  const result = service.assignReceiptNumber(assignRequest('PAY-NUMEROTAT'));

  assert.equal(result.receiptNumber, 41);
  assert.equal(storedPayment('PAY-NUMEROTAT').receiptNumber, 41);
  // Contorul nu a crescut — retipărirea nu consumă un număr nou.
  assert.equal(JSON.parse(settings.readSetting('kindergarten')).nextReceiptNumber, 100);
});

test('refuză o achitare ștearsă între timp, fără să consume un număr', () => {
  const { service, settings } = createHarness({ kindergarten: { nextReceiptNumber: 7 } });

  assert.throws(() => service.assignReceiptNumber(assignRequest('PAY-LIPSA')), {
    status: 409,
    message: /nu mai există/,
  });
  assert.equal(JSON.parse(settings.readSetting('kindergarten') || '{}').nextReceiptNumber, 7);
});

test('refuză un identificator de achitare invalid', () => {
  const { service } = createHarness();
  assert.throws(() => service.assignReceiptNumber(assignRequest('')), { status: 400 });
  assert.throws(() => service.assignReceiptNumber(assignRequest(undefined)), { status: 400 });
});
