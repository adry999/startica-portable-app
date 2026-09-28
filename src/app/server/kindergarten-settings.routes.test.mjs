import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryRecordRepository } from '#test-support/in-memory-record-repository.mjs';
import { createRecordingAuditTrail } from '#test-support/recording-audit-trail.mjs';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { createKindergartenSettingsRoutes } from './kindergarten-settings.routes.mjs';
import { DEFAULT_KINDERGARTEN_SETTINGS } from '#shared/domain/kindergarten-settings.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Payment} Payment */

/**
 * @param {string} id
 * @param {number} receiptNumber
 * @returns {Payment}
 */
const payment = (id, receiptNumber) =>
  normalizeRecord('payments', {
    id,
    date: '2026-09-01',
    amount: 1000,
    method: 'Cash',
    receiptNumber,
    allocations: [{ month: '2026-09', amount: 1000 }],
  });

/**
 * @param {ReturnType<typeof createKindergartenSettingsRoutes>} routes
 * @param {'GET' | 'POST'} method
 */
function routeHandle(routes, method) {
  const route = routes.find(r => r.method === method);
  if (!route) throw new Error(`Ruta ${method} nu a fost găsită.`);
  return route.handle;
}

/** @param {{ payments?: Payment[], kindergarten?: Record<string, unknown> }} [options] */
function createHarness({ payments = [], kindergarten } = {}) {
  const recordRepository = createInMemoryRecordRepository({ payments });
  const auditTrail = createRecordingAuditTrail();
  const store = new Map(kindergarten ? [['kindergarten', JSON.stringify(kindergarten)]] : []);
  const routes = createKindergartenSettingsRoutes({
    readSetting: key => store.get(key) ?? '',
    writeSetting: (key, value) => store.set(key, value),
    recordRepository,
    auditTrail,
  });
  const post = /** @param {unknown} body */ body => /** @type {any} */ (routeHandle(routes, 'POST')({ body }));
  const get = () => /** @type {any} */ (routeHandle(routes, 'GET')({ body: undefined }));
  return { post, get, auditTrail };
}

test('POST /api/kindergarten nu poate da înapoi nextReceiptNumber sub valoarea deja salvată (fila deschisă cu o valoare veche)', () => {
  const { post } = createHarness({ kindergarten: { nextReceiptNumber: 45 } });

  // Operatorul salvează denumirea cu valoarea încărcată la deschiderea filei (41), stale.
  const result = post({ name: 'Grădinița Curcubeu', nextReceiptNumber: 41 });

  assert.equal(result.nextReceiptNumber, 45);
});

test('POST /api/kindergarten nu poate da nextReceiptNumber sub cel mai mare receiptNumber deja emis', () => {
  const { post } = createHarness({
    payments: [payment('PAY-1', 44)],
    kindergarten: { nextReceiptNumber: 10 }, // setările nu au fost actualizate când s-au emis confirmările
  });

  const result = post({ nextReceiptNumber: 1 });

  assert.equal(result.nextReceiptNumber, 45);
});

test('POST /api/kindergarten permite să crească explicit nextReceiptNumber peste orice valoare emisă', () => {
  const { post } = createHarness({ payments: [payment('PAY-1', 44)], kindergarten: { nextReceiptNumber: 45 } });

  const result = post({ nextReceiptNumber: 100 });

  assert.equal(result.nextReceiptNumber, 100);
});

test('POST /api/kindergarten ignoră achitările arhivate la calculul celui mai mare receiptNumber emis', () => {
  const archived = { ...payment('PAY-1', 44), archived: true };
  const { post } = createHarness({ payments: [archived], kindergarten: { nextReceiptNumber: 5 } });

  const result = post({ nextReceiptNumber: 1 });

  // O confirmare arhivată (anulată) nu mai blochează reutilizarea numărului ei.
  assert.equal(result.nextReceiptNumber, 5);
});

test('POST /api/kindergarten trece schimbarea numărului în istoric', () => {
  const { post, auditTrail } = createHarness({ kindergarten: { nextReceiptNumber: 45 } });

  post({ nextReceiptNumber: 41 });

  assert.equal(auditTrail.changes.length, 1);
  const [change] = auditTrail.changes;
  assert.equal(/** @type {any} */ (change.before).nextReceiptNumber, 45);
  assert.equal(/** @type {any} */ (change.after).nextReceiptNumber, 45);
  assert.equal(change.recordType, null);
});

test('GET /api/kindergarten fără nimic salvat întoarce implicitele', () => {
  const { get } = createHarness();
  assert.deepEqual(get(), DEFAULT_KINDERGARTEN_SETTINGS);
});
