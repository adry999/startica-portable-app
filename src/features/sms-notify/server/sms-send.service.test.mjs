import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { createRecordingAuditTrail } from '#test-support/recording-audit-trail.mjs';
import { createSmsLogRepository } from './sms-log.repository.mjs';
import { createSmsTemplateRepository } from './sms-template.repository.mjs';
import { createSmsService } from './sms.service.mjs';
import { createSmsSendService, NOT_CONNECTED_MESSAGE } from './sms-send.service.mjs';
import { createFakeSmsApi, SMS_RESPONSES } from '../test-support/fake-sms-api.mjs';

const NOW = '2026-09-27T10:00:00.000Z';

/** @param {Partial<import('../sms-notify.types.mjs').SmsSendMessage>} overrides @returns {import('../sms-notify.types.mjs').SmsSendMessage} */
function message(overrides = {}) {
  return {
    childId: 'c1',
    childName: 'Ion',
    recipientName: 'Maria',
    phone: '+37369123456',
    text: 'Salut',
    ...overrides,
  };
}

/** @param {Partial<import('../sms-notify.types.mjs').NewSmsLogEntry>} overrides @returns {import('../sms-notify.types.mjs').NewSmsLogEntry} */
function loggedEntry(overrides = {}) {
  return {
    createdAt: '2026-09-27T09:00:00.000Z',
    childId: 'c1',
    recipientName: 'Maria',
    childName: 'Ion',
    phone: '+37369123456',
    text: 'Salut',
    templateId: null,
    templateName: 'Personalizat',
    month: '2026-09',
    source: 'notify',
    characters: 5,
    segments: 1,
    encoding: 'gsm-7',
    cost: '0.30',
    status: 'sent',
    providerId: null,
    providerStatus: 'Queued',
    providerError: '',
    statusCheckedAt: '',
    batchId: null,
    ...overrides,
  };
}

/**
 * @param {import('node:test').TestContext} t
 * @param {{ smsResponses?: any, monthlyLimit?: number | null, connected?: boolean }} [options]
 */
function createDeps(t, { smsResponses = {}, monthlyLimit = null, connected = true } = {}) {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  t.after(() => database.close());
  const smsLogRepository = createSmsLogRepository(database);
  const smsTemplateRepository = createSmsTemplateRepository(database, { now: () => new Date(NOW) });
  const { fetch, calls } = createFakeSmsApi(smsResponses);
  const smsService = createSmsService({ fetch });
  const auditTrail = createRecordingAuditTrail();
  /** @type {number[]} */
  const sleepCalls = [];
  const sleep = async ms => void sleepCalls.push(ms);
  const now = () => new Date(NOW);
  const readConfig = () => (connected ? { token: 'tok-1234abcd', sender: 'Startica', monthlyLimit } : null);
  const sendService = createSmsSendService({
    smsService,
    smsLogRepository,
    smsTemplateRepository,
    readConfig,
    auditTrail,
    now,
    sleep,
  });
  return { database, smsLogRepository, smsTemplateRepository, auditTrail, calls, sleepCalls, sendService };
}

const sendCallsOf = calls => calls.filter(call => call.method === 'POST' && call.url.includes('/v3/messages'));

test('sendBatch: lot de 3 trimite în ordine, cu pauză între cereri, scrie jurnalul și un audit fără telefon/token', async t => {
  const { smsLogRepository, auditTrail, calls, sleepCalls, sendService } = createDeps(t);
  const messages = [
    message({ childId: 'c1', phone: '+37369123456' }),
    message({ childId: 'c2', phone: '+37369123457' }),
    message({ childId: 'c3', phone: '+37369123458' }),
  ];
  const result = await sendService.sendBatch({
    source: 'notify',
    month: '2026-09',
    templateId: 'TPL-restanta',
    requestId: 'req-lot-3-01',
    messages,
  });

  assert.equal(sendCallsOf(calls).length, 3);
  assert.deepEqual(sleepCalls, [1000, 1000]);
  assert.equal(result.ok, true);
  assert.equal(result.stopped, null);
  assert.equal(result.results.length, 3);
  for (const outcome of result.results) {
    assert.equal(outcome.outcome, 'sent');
    const row = smsLogRepository.find(/** @type {number} */ (outcome.logId));
    assert.equal(row?.status, 'sent');
    assert.equal(row?.providerId, 'msg-1');
    assert.equal(row?.segments, 1);
    assert.equal(row?.cost, '0.30');
  }

  assert.equal(auditTrail.changes.length, 1);
  const [audit] = auditTrail.changes;
  assert.equal(audit.action, 'trimitere sms');
  assert.deepEqual(audit.after, {
    source: 'notify',
    month: '2026-09',
    templateName: 'Reamintire restanță',
    requested: 3,
    sent: 3,
    failed: 0,
    skipped: 0,
    cost: '0.90',
  });
  const auditJson = JSON.stringify(audit);
  assert.ok(!auditJson.includes('+3736'));
  assert.ok(!auditJson.includes('tok-1234abcd'));
});

test('sendBatch: eroare de destinatar (422 to) marchează rândul failed și lotul continuă', async t => {
  const { smsLogRepository, sendService } = createDeps(t, {
    smsResponses: { send: [undefined, SMS_RESPONSES.invalidTo, undefined] },
  });
  const messages = [message({ childId: 'c1' }), message({ childId: 'c2' }), message({ childId: 'c3' })];
  const result = await sendService.sendBatch({
    source: 'notify',
    month: '2026-09',
    templateId: null,
    requestId: 'req-eroare-destinatar-01',
    messages,
  });

  assert.equal(result.stopped, null);
  assert.equal(result.ok, false);
  assert.equal(result.results[1].outcome, 'failed');
  const failedRow = smsLogRepository.find(/** @type {number} */ (result.results[1].logId));
  assert.ok(failedRow?.providerError.startsWith('VALIDATION_ERROR'));
  assert.equal(result.results[2].outcome, 'sent');
});

test('sendBatch: 402 la al doilea mesaj oprește lotul, al treilea e skipped fără rând în jurnal', async t => {
  const { smsLogRepository, calls, sendService } = createDeps(t, {
    smsResponses: { send: [undefined, SMS_RESPONSES.insufficientBalance] },
  });
  const messages = [message({ childId: 'c1' }), message({ childId: 'c2' }), message({ childId: 'c3' })];
  const result = await sendService.sendBatch({
    source: 'notify',
    month: '2026-09',
    templateId: null,
    requestId: 'req-402-01',
    messages,
  });

  assert.equal(result.stopped?.code, 'INSUFFICIENT_BALANCE');
  assert.equal(result.results[1].outcome, 'failed');
  assert.deepEqual(result.results[2], {
    childId: 'c3',
    outcome: 'skipped',
    logId: null,
    segments: 0,
    cost: null,
    error: result.stopped?.message,
  });
  assert.equal(sendCallsOf(calls).length, 2);
  assert.equal(smsLogRepository.monthlyStats(new Date(NOW)).failedThisMonth, 1);
});

test('sendBatch: 429 la al doilea mesaj oprește lotul, fără pauză suplimentară', async t => {
  const { sleepCalls, sendService } = createDeps(t, {
    smsResponses: { send: [undefined, SMS_RESPONSES.rateLimited] },
  });
  const messages = [message({ childId: 'c1' }), message({ childId: 'c2' }), message({ childId: 'c3' })];
  const result = await sendService.sendBatch({
    source: 'notify',
    month: '2026-09',
    templateId: null,
    requestId: 'req-429-01',
    messages,
  });

  assert.equal(result.stopped?.code, 'RATE_LIMIT_EXCEEDED');
  assert.deepEqual(sleepCalls, [1000]);
});

test('sendBatch: peste limita lunară respinge cu 400, fără niciun apel de rețea', async t => {
  const { smsLogRepository, calls, sendService } = createDeps(t, { monthlyLimit: 2 });
  smsLogRepository.insert(loggedEntry({ childId: 'c0', createdAt: '2026-09-27T08:00:00.000Z' }));
  const messages = [message({ childId: 'c1' }), message({ childId: 'c2' })];

  await assert.rejects(
    () =>
      sendService.sendBatch({
        source: 'notify',
        month: '2026-09',
        templateId: null,
        requestId: 'req-limita-lunara-01',
        messages,
      }),
    error => {
      assert.equal(/** @type {any} */ (error).status, 400);
      assert.match(/** @type {Error} */ (error).message, /Limita lunară de 2 SMS/);
      return true;
    },
  );
  assert.equal(calls.length, 0);
});

test('sendBatch: sold sms.md insuficient respinge cu 400, fără trimitere', async t => {
  const { calls, sendService } = createDeps(t, {
    smsResponses: {
      balance: { body: { status: 'success', httpCode: 200, data: { balance: '0.30', currency: 'MDL' } } },
    },
  });
  const messages = [message({ childId: 'c1', text: 'aa' }), message({ childId: 'c2', text: 'bb' })];

  await assert.rejects(
    () =>
      sendService.sendBatch({
        source: 'notify',
        month: '2026-09',
        templateId: null,
        requestId: 'req-sold-insuficient-01',
        messages,
      }),
    error => {
      assert.match(/** @type {Error} */ (error).message, /Sold sms.md insuficient/);
      return true;
    },
  );
  assert.equal(sendCallsOf(calls).length, 0);
});

test('sendBatch: eșecul GET balance (rețea) nu blochează lotul', async t => {
  const { calls, sendService } = createDeps(t, {
    smsResponses: {
      balance: () => {
        throw new TypeError('fetch failed');
      },
    },
  });
  const messages = [message({ childId: 'c1' }), message({ childId: 'c2' })];
  const result = await sendService.sendBatch({
    source: 'notify',
    month: '2026-09',
    templateId: null,
    requestId: 'req-balance-network-01',
    messages,
  });

  assert.equal(result.ok, true);
  assert.equal(sendCallsOf(calls).length, 2);
});

test('sendBatch: telefon nenormalizabil respinge lotul cu 400, fără apel', async t => {
  const { calls, sendService } = createDeps(t);
  await assert.rejects(() =>
    sendService.sendBatch({
      source: 'notify',
      month: '2026-09',
      templateId: null,
      requestId: 'req-telefon-invalid-01',
      messages: [message({ phone: '123' })],
    }),
  );
  assert.equal(calls.length, 0);
});

test('sendBatch: text peste 800 de caractere respinge lotul cu 400, fără apel', async t => {
  const { calls, sendService } = createDeps(t);
  await assert.rejects(() =>
    sendService.sendBatch({
      source: 'notify',
      month: '2026-09',
      templateId: null,
      requestId: 'req-text-lung-01',
      messages: [message({ text: 'x'.repeat(801) })],
    }),
  );
  assert.equal(calls.length, 0);
});

test('sendBatch: source manual cu childId null și recipientName trimite cu succes', async t => {
  const { smsLogRepository, sendService } = createDeps(t);
  const result = await sendService.sendBatch({
    source: 'manual',
    month: null,
    templateId: null,
    requestId: 'req-manual-01',
    messages: [
      message({ childId: null, childName: '', recipientName: 'Elena Rusu', phone: '+37369123456', text: 'Salut' }),
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.results[0].outcome, 'sent');
  assert.equal(result.results[0].childId, null);
  const row = smsLogRepository.find(/** @type {number} */ (result.results[0].logId));
  assert.equal(row?.childId, null);
  assert.equal(row?.recipientName, 'Elena Rusu');
  assert.equal(row?.source, 'manual');
});

test('sendBatch: source manual cu telefon invalid respinge lotul cu 400, fără apel', async t => {
  const { calls, sendService } = createDeps(t);
  await assert.rejects(() =>
    sendService.sendBatch({
      source: 'manual',
      month: null,
      templateId: null,
      requestId: 'req-manual-telefon-invalid-01',
      messages: [message({ childId: null, recipientName: 'Elena Rusu', phone: '123' })],
    }),
  );
  assert.equal(calls.length, 0);
});

test('sendBatch: childId gol respinge lotul cu 400, fără apel', async t => {
  const { calls, sendService } = createDeps(t);
  await assert.rejects(() =>
    sendService.sendBatch({
      source: 'notify',
      month: '2026-09',
      templateId: null,
      requestId: 'req-childid-gol-01',
      messages: [message({ childId: '' })],
    }),
  );
  assert.equal(calls.length, 0);
});

test('sendBatch: source notify cu childId null respinge lotul cu 400 (regresie — doar manual poate omite copilul)', async t => {
  const { calls, sendService } = createDeps(t);
  await assert.rejects(() =>
    sendService.sendBatch({
      source: 'notify',
      month: '2026-09',
      templateId: null,
      requestId: 'req-notify-childid-null-01',
      messages: [message({ childId: null })],
    }),
  );
  assert.equal(calls.length, 0);
});

test('sendBatch: fără configurare respinge cu 400 și mesajul de neconectat', async t => {
  const { sendService } = createDeps(t, { connected: false });
  await assert.rejects(
    () =>
      sendService.sendBatch({
        source: 'notify',
        month: '2026-09',
        templateId: null,
        requestId: 'req-neconectat-01',
        messages: [message()],
      }),
    error => {
      assert.equal(/** @type {any} */ (error).status, 400);
      assert.equal(/** @type {Error} */ (error).message, NOT_CONNECTED_MESSAGE);
      return true;
    },
  );
});

test('sendBatch: requestId lipsă sau invalid respinge cu 400, fără apel', async t => {
  const { calls, sendService } = createDeps(t);
  await assert.rejects(() =>
    // Cast: testăm exact cazul JS-valid/TS-invalid — un apelant care omite requestId-ul obligatoriu.
    sendService.sendBatch(
      /** @type {any} */ ({ source: 'notify', month: '2026-09', templateId: null, messages: [message()] }),
    ),
  );
  await assert.rejects(() =>
    sendService.sendBatch({
      source: 'notify',
      month: '2026-09',
      templateId: null,
      requestId: 'scurt',
      messages: [message()],
    }),
  );
  assert.equal(calls.length, 0);
});

test('sendBatch: reluare cu același requestId nu retrimite — întoarce rezultatul memorat, un singur apel', async t => {
  const { smsLogRepository, calls, sendService } = createDeps(t);
  const messages = [message({ childId: 'c1' }), message({ childId: 'c2' })];
  /** @type {import('../sms-notify.types.mjs').SmsSendRequest} */
  const request = { source: 'notify', month: '2026-09', templateId: null, requestId: 'req-reluare-01', messages };

  const first = await sendService.sendBatch(request);
  const second = await sendService.sendBatch(request);

  assert.equal(sendCallsOf(calls).length, 2);
  assert.deepEqual(second, first);
  assert.equal(smsLogRepository.monthlyStats(new Date(NOW)).sentThisMonth, 2);
});

test('sendBatch: reluare după un lot oprit (402) reconstruiește sent+failed+skipped, fără apel nou', async t => {
  const { calls, sendService } = createDeps(t, {
    smsResponses: { send: [undefined, SMS_RESPONSES.insufficientBalance] },
  });
  const messages = [message({ childId: 'c1' }), message({ childId: 'c2' }), message({ childId: 'c3' })];
  /** @type {import('../sms-notify.types.mjs').SmsSendRequest} */
  const request = {
    source: 'notify',
    month: '2026-09',
    templateId: null,
    requestId: 'req-reluare-402-01',
    messages,
  };

  const first = await sendService.sendBatch(request);
  const callsAfterFirst = sendCallsOf(calls).length;
  const second = await sendService.sendBatch(request);

  assert.deepEqual(second, first);
  assert.equal(second.results[0].outcome, 'sent');
  assert.equal(second.results[1].outcome, 'failed');
  assert.equal(second.results[2].outcome, 'skipped');
  assert.equal(second.stopped?.code, 'INSUFFICIENT_BALANCE');
  assert.equal(sendCallsOf(calls).length, callsAfterFirst);
});

test('sendTest: trimite mesajul fix și scrie un rând cu source test, childId null, recipientName Test', async t => {
  const { sendService } = createDeps(t);
  const entry = await sendService.sendTest('069123456');
  assert.equal(entry.source, 'test');
  assert.equal(entry.childId, null);
  assert.equal(entry.recipientName, 'Test');
  assert.equal(entry.status, 'sent');
  assert.equal(entry.phone, '+37369123456');
});

test('refreshDeliveryStatuses: mapează Delivered/Undelivered/Queued, ignoră rândurile mai vechi de 48h', async t => {
  const { smsLogRepository, sendService } = createDeps(t, {
    smsResponses: {
      message: id => {
        if (id === 'p-delivered')
          return { body: { status: 'success', httpCode: 200, data: { id, status: { id: 3, name: 'Delivered' } } } };
        if (id === 'p-undelivered')
          return { body: { status: 'success', httpCode: 200, data: { id, status: { id: 9, name: 'Undelivered' } } } };
        if (id === 'p-queued')
          return { body: { status: 'success', httpCode: 200, data: { id, status: { id: 1, name: 'Queued' } } } };
        return undefined;
      },
    },
  });

  const delivered = smsLogRepository.insert(loggedEntry({ providerId: 'p-delivered' }));
  const undelivered = smsLogRepository.insert(loggedEntry({ providerId: 'p-undelivered' }));
  const queued = smsLogRepository.insert(loggedEntry({ providerId: 'p-queued' }));
  const old = smsLogRepository.insert(loggedEntry({ providerId: 'p-old', createdAt: '2026-09-20T09:00:00.000Z' }));

  const result = await sendService.refreshDeliveryStatuses();

  assert.equal(smsLogRepository.find(delivered)?.status, 'delivered');
  assert.equal(smsLogRepository.find(delivered)?.providerStatus, 'Delivered');
  assert.ok(smsLogRepository.find(delivered)?.statusCheckedAt);
  assert.equal(smsLogRepository.find(undelivered)?.status, 'failed');
  assert.equal(smsLogRepository.find(undelivered)?.providerError, 'Undelivered');
  assert.equal(smsLogRepository.find(queued)?.status, 'sent');
  assert.equal(smsLogRepository.find(old)?.status, 'unknown');
  assert.equal(result.updated, 3);
});

test('refreshDeliveryStatuses: eșecul rețelei la prima interogare lasă rândurile neschimbate', async t => {
  const { smsLogRepository, sendService } = createDeps(t, {
    smsResponses: {
      message: () => {
        throw new TypeError('fetch failed');
      },
    },
  });
  const id = smsLogRepository.insert(loggedEntry({ providerId: 'p-1' }));

  const result = await sendService.refreshDeliveryStatuses();

  assert.equal(result.updated, 0);
  assert.equal(smsLogRepository.find(id)?.status, 'sent');
  assert.equal(smsLogRepository.find(id)?.statusCheckedAt, '');
});
