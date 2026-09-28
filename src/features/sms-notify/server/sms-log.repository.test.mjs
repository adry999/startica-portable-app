import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { createSmsLogRepository } from './sms-log.repository.mjs';

function openRepository(t) {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  t.after(() => database.close());
  return { database, repository: createSmsLogRepository(database) };
}

/** @returns {import('../sms-notify.types.mjs').NewSmsLogEntry} */
function entry(overrides = {}) {
  return {
    createdAt: '2026-09-27T10:00:00.000Z',
    childId: 'c1',
    recipientName: 'Maria',
    childName: 'Ion',
    phone: '+37369123456',
    text: 'Buna ziua',
    templateId: 'TPL-restanta',
    templateName: 'Reamintire restanță',
    month: '2026-09',
    source: 'notify',
    characters: 9,
    segments: 1,
    encoding: 'gsm-7',
    cost: null,
    status: 'failed',
    providerId: null,
    providerStatus: '',
    providerError: '',
    statusCheckedAt: '',
    batchId: null,
    ...overrides,
  };
}

/** @param {Date} now */
function monthBounds(now) {
  return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)];
}

test('insert apoi update({status,...}) → find întoarce rândul îmbinat cu id', t => {
  const { repository } = openRepository(t);
  const id = repository.insert(entry());
  assert.equal(typeof id, 'number');
  repository.update(id, { status: 'sent', providerId: 'uuid-1', segments: 2, cost: '0.60' });
  assert.deepEqual(repository.find(id), {
    ...entry(),
    id,
    status: 'sent',
    providerId: 'uuid-1',
    segments: 2,
    cost: '0.60',
  });
});

test('monthlyStats ignoră failed și alte luni; adună segments doar pe non-failed', t => {
  const { repository } = openRepository(t);
  const now = new Date(2026, 8, 27, 12);
  const [start, end] = monthBounds(now);
  repository.insert(entry({ createdAt: start.toISOString(), status: 'sent', segments: 2 }));
  repository.insert(
    entry({ createdAt: new Date(start.getTime() + 3_600_000).toISOString(), status: 'delivered', segments: 3 }),
  );
  repository.insert(
    entry({ createdAt: new Date(start.getTime() + 7_200_000).toISOString(), status: 'failed', segments: 5 }),
  );
  repository.insert(entry({ createdAt: new Date(start.getTime() - 1).toISOString(), status: 'sent', segments: 9 }));
  repository.insert(entry({ createdAt: end.toISOString(), status: 'sent', segments: 11 }));
  assert.deepEqual(repository.monthlyStats(now), { sentThisMonth: 2, failedThisMonth: 1, segmentsThisMonth: 5 });
});

test('lastUnitCost: 0.3 pe jurnal gol; rămâne cost/segments al ultimului rând cu cost', t => {
  const { repository } = openRepository(t);
  assert.equal(repository.lastUnitCost(), 0.3);
  repository.insert(entry({ createdAt: '2026-09-27T10:00:00.000Z', status: 'sent', cost: '0.60', segments: 2 }));
  assert.equal(repository.lastUnitCost(), 0.3);
  repository.insert(entry({ createdAt: '2026-09-27T10:00:01.000Z', status: 'sent', cost: '0.90', segments: 2 }));
  assert.equal(repository.lastUnitCost(), 0.45);
});

test('lastNotifiedByChild ignoră failed și source „test”, ia cel mai recent rând per copil', t => {
  const { repository } = openRepository(t);
  repository.insert(
    entry({ childId: 'c1', createdAt: '2026-09-20T10:00:00.000Z', status: 'sent', templateName: 'Vechi' }),
  );
  repository.insert(
    entry({ childId: 'c1', createdAt: '2026-09-25T10:00:00.000Z', status: 'delivered', templateName: 'Nou' }),
  );
  repository.insert(
    entry({ childId: 'c1', createdAt: '2026-09-26T10:00:00.000Z', status: 'failed', templateName: 'Ignorat' }),
  );
  repository.insert(
    entry({
      childId: 'c1',
      createdAt: '2026-09-27T10:00:00.000Z',
      source: 'test',
      status: 'sent',
      templateName: 'Ignorat-test',
    }),
  );
  repository.insert(
    entry({ childId: 'c2', createdAt: '2026-09-22T10:00:00.000Z', status: 'sent', templateName: 'Alt copil' }),
  );
  assert.deepEqual(repository.lastNotifiedByChild(), {
    c1: { at: '2026-09-25T10:00:00.000Z', status: 'delivered', month: '2026-09', templateName: 'Nou' },
    c2: { at: '2026-09-22T10:00:00.000Z', status: 'sent', month: '2026-09', templateName: 'Alt copil' },
  });
});

test('pendingDelivery: doar sent cu providerId, cele mai noi primele, limitat', t => {
  const { repository } = openRepository(t);
  repository.insert(entry({ createdAt: '2026-09-25T10:00:00.000Z', status: 'sent', providerId: 'p1' }));
  repository.insert(entry({ createdAt: '2026-09-25T11:00:00.000Z', status: 'sent', providerId: null }));
  repository.insert(entry({ createdAt: '2026-09-25T12:00:00.000Z', status: 'failed', providerId: 'p2' }));
  const second = repository.insert(entry({ createdAt: '2026-09-25T13:00:00.000Z', status: 'sent', providerId: 'p3' }));
  const third = repository.insert(entry({ createdAt: '2026-09-25T14:00:00.000Z', status: 'sent', providerId: 'p4' }));
  assert.deepEqual(
    repository.pendingDelivery(2).map(row => row.id),
    [third, second],
  );
});

test('markUnknownOlderThan trece pe „unknown” doar rândurile sent mai vechi decât cutoff', t => {
  const { repository } = openRepository(t);
  const old = repository.insert(entry({ createdAt: '2026-09-20T10:00:00.000Z', status: 'sent' }));
  const recent = repository.insert(entry({ createdAt: '2026-09-26T10:00:00.000Z', status: 'sent' }));
  const failedOld = repository.insert(entry({ createdAt: '2026-09-20T10:00:00.000Z', status: 'failed' }));
  assert.equal(repository.markUnknownOlderThan('2026-09-25T10:00:00.000Z'), 1);
  assert.equal(repository.find(old)?.status, 'unknown');
  assert.equal(repository.find(recent)?.status, 'sent');
  assert.equal(repository.find(failedOld)?.status, 'failed');
});

test('listSince: doar rândurile de la cutoff încolo, cele mai noi primele', t => {
  const { repository } = openRepository(t);
  const old = repository.insert(entry({ createdAt: '2026-08-01T10:00:00.000Z' }));
  const first = repository.insert(entry({ createdAt: '2026-09-10T10:00:00.000Z' }));
  const second = repository.insert(entry({ createdAt: '2026-09-20T10:00:00.000Z' }));
  assert.deepEqual(
    repository.listSince('2026-09-01T00:00:00.000Z').map(row => row.id),
    [second, first],
  );
  void old;
});

test('monthlyBreakdown: adună mesaje, segmente (non-failed) și eșuate pe fiecare lună, descrescător', t => {
  const { repository } = openRepository(t);
  repository.insert(entry({ createdAt: '2026-08-01T10:00:00.000Z', status: 'sent', segments: 2 }));
  repository.insert(entry({ createdAt: '2026-08-15T10:00:00.000Z', status: 'failed', segments: 9 }));
  repository.insert(entry({ createdAt: '2026-09-05T10:00:00.000Z', status: 'delivered', segments: 3 }));
  repository.insert(entry({ createdAt: '2026-09-06T10:00:00.000Z', status: 'sent', segments: 1 }));
  assert.deepEqual(repository.monthlyBreakdown(), [
    { month: '2026-09', sent: 2, segments: 4, failed: 0 },
    { month: '2026-08', sent: 1, segments: 2, failed: 1 },
  ]);
});

test('usageCountByTemplate: numără doar non-failed, grupat pe templateId', t => {
  const { repository } = openRepository(t);
  repository.insert(entry({ templateId: 'TPL-a', status: 'sent' }));
  repository.insert(entry({ templateId: 'TPL-a', status: 'delivered' }));
  repository.insert(entry({ templateId: 'TPL-a', status: 'failed' }));
  repository.insert(entry({ templateId: 'TPL-b', status: 'sent' }));
  repository.insert(entry({ templateId: null, status: 'sent' }));
  assert.deepEqual(repository.usageCountByTemplate(), { 'TPL-a': 2, 'TPL-b': 1 });
});

test('monthlyBreakdown grupează pe luna locală (Europe/Chisinau), nu pe luna UTC a lui created_at', t => {
  const previousTz = process.env.TZ;
  process.env.TZ = 'Europe/Chisinau';
  t.after(() => {
    process.env.TZ = previousTz;
  });
  const { repository } = openRepository(t);
  // 2026-02-01T00:30 local (EET, UTC+2) = 2026-01-31T22:30Z: luna UTC e ianuarie, luna locală e februarie.
  repository.insert(entry({ createdAt: '2026-01-31T22:30:00.000Z', status: 'sent', segments: 2 }));
  assert.deepEqual(repository.monthlyBreakdown(), [{ month: '2026-02', sent: 1, segments: 2, failed: 0 }]);
});

test('expireOldEntries: cutoff-ul e miezul nopții local, nu UTC — un rând scris puțin după nu se șterge', t => {
  const previousTz = process.env.TZ;
  process.env.TZ = 'Europe/Chisinau';
  t.after(() => {
    process.env.TZ = previousTz;
  });
  const { repository } = openRepository(t);
  // 2025-09-28T00:00 local (EEST, UTC+3) = 2025-09-27T21:00Z: cutoff-ul UTC vechi ('...T00:00:00.000Z')
  // ar fi tăiat 3h mai devreme, ștergând greșit un rând scris chiar după miezul nopții local.
  const keptJustAfterLocalMidnight = repository.insert(entry({ createdAt: '2025-09-27T22:00:00.000Z' }));
  assert.deepEqual(repository.expireOldEntries('2026-09-27'), { expired: 0 });
  assert.notEqual(repository.find(keptJustAfterLocalMidnight)?.text, '');
});

test('listByBatch: doar rândurile lotului cerut, în ordinea inserării', t => {
  const { repository } = openRepository(t);
  const first = repository.insert(entry({ childId: 'c1', batchId: 'BATCH-1' }));
  repository.insert(entry({ childId: 'c2', batchId: 'BATCH-altul' }));
  const second = repository.insert(entry({ childId: 'c3', batchId: 'BATCH-1' }));
  assert.deepEqual(
    repository.listByBatch('BATCH-1').map(row => row.id),
    [first, second],
  );
  assert.deepEqual(
    repository.listByBatch('BATCH-altul').map(row => row.childId),
    ['c2'],
  );
  assert.deepEqual(repository.listByBatch('BATCH-inexistent'), []);
});

test('expireOldEntries golește text/phone la exact 365 de zile; e idempotent', t => {
  const { repository } = openRepository(t);
  const expired = repository.insert(entry({ createdAt: '2025-09-27T18:00:00.000Z' }));
  const kept = repository.insert(entry({ createdAt: '2025-09-28T00:00:00.000Z' }));
  assert.deepEqual(repository.expireOldEntries('2026-09-27'), { expired: 1 });
  assert.equal(repository.find(expired)?.text, '');
  assert.equal(repository.find(expired)?.phone, '');
  assert.notEqual(repository.find(kept)?.text, '');
  assert.deepEqual(repository.expireOldEntries('2026-09-27'), { expired: 0 });
});
