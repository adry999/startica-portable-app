import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { createAttendanceRepository } from './attendance.repository.mjs';

const FIXED_NOW = () => new Date('2026-09-27T10:00:00.000Z');

function createRepository(options = {}) {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  return { database, repository: createAttendanceRepository(database, { now: FIXED_NOW, ...options }) };
}

test('upsert-ul pe aceeași zi înlocuiește starea și motivul fără să dubleze rândul', () => {
  const { database, repository } = createRepository();
  repository.applyChanges([{ childId: 'c1', date: '2026-09-27', status: 'present', reason: '' }]);
  repository.applyChanges([{ childId: 'c1', date: '2026-09-27', status: 'excused', reason: 'Boală' }]);

  const rows = database.prepare('SELECT * FROM attendance').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'excused');
  assert.equal(rows[0].reason, 'Boală');
});

test('status null șterge rândul; ștergerea unui rând inexistent nu e eroare', () => {
  const { database, repository } = createRepository();
  repository.applyChanges([{ childId: 'c1', date: '2026-09-27', status: 'present', reason: '' }]);

  const result = repository.applyChanges([
    { childId: 'c1', date: '2026-09-27', status: null },
    { childId: 'c2', date: '2026-09-27', status: null },
  ]);

  assert.deepEqual(result.removed, [
    { childId: 'c1', date: '2026-09-27' },
    { childId: 'c2', date: '2026-09-27' },
  ]);
  assert.equal(database.prepare('SELECT * FROM attendance').all().length, 0);
});

test('listByMonth întoarce doar zilele lunii, filtrate după copii, ordonate după dată', () => {
  const { repository } = createRepository();
  repository.applyChanges([
    { childId: 'c1', date: '2026-08-31', status: 'present', reason: '' },
    { childId: 'c1', date: '2026-09-02', status: 'present', reason: '' },
    { childId: 'c2', date: '2026-09-01', status: 'absent', reason: '' },
    { childId: 'c3', date: '2026-09-01', status: 'present', reason: '' },
    { childId: 'c1', date: '2026-10-01', status: 'present', reason: '' },
  ]);

  const entries = repository.listByMonth('2026-09');
  assert.deepEqual(
    entries.map(entry => `${entry.date}|${entry.childId}`),
    ['2026-09-01|c2', '2026-09-01|c3', '2026-09-02|c1'],
  );

  const filtered = repository.listByMonth('2026-09', ['c1', 'c2']);
  assert.deepEqual(
    filtered.map(entry => `${entry.date}|${entry.childId}`),
    ['2026-09-01|c2', '2026-09-02|c1'],
  );
});

test('prezența notifică onChange în aceeași tranzacție, cu payload la salvare și null la ștergere', () => {
  const notified = [];
  const { repository } = createRepository({ onChange: change => notified.push(change) });

  repository.applyChanges([{ childId: 'c1', date: '2026-09-27', status: 'present', reason: '' }]);
  repository.applyChanges([{ childId: 'c1', date: '2026-09-27', status: null }]);

  assert.equal(notified.length, 2);
  assert.equal(notified[0].kind, 'attendance');
  assert.equal(notified[0].id, 'c1|2026-09-27');
  assert.equal(notified[0].payload.status, 'present');
  assert.equal(notified[1].payload, null);
});

test('un onChange care aruncă anulează tot lotul, ca oricare altă eroare din tranzacție', () => {
  const { database, repository } = createRepository({
    onChange: () => {
      throw new Error('eroare simulată în scrierea outbox-ului');
    },
  });

  assert.throws(() => repository.applyChanges([{ childId: 'c1', date: '2026-09-27', status: 'present', reason: '' }]));
  assert.equal(database.prepare('SELECT * FROM attendance').all().length, 0);
});

test('o eroare la mijlocul lotului anulează tot lotul', () => {
  const { database, repository } = createRepository();
  // date: null nu e o schimbare validă (ar fi respinsă de rutele care validează dinainte);
  // testul verifică doar atomicitatea tranzacției din repository, la nivelul SQLite.
  const badBatch = /** @type {any} */ ([
    { childId: 'c1', date: '2026-09-27', status: 'present', reason: '' },
    { childId: 'c2', date: null, status: 'present', reason: '' },
  ]);
  assert.throws(() => repository.applyChanges(badBatch));
  assert.equal(database.prepare('SELECT * FROM attendance').all().length, 0);
});
