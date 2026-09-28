import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { createPoolRepository } from './pool.repository.mjs';

const BOOKING = {
  id: 'PB-1',
  childId: 'C-1',
  coachId: 'STF-1',
  weekday: 2,
  time: '09:00',
  startDate: '2026-09-01',
  endDate: null,
  archivedAt: null,
  updatedAt: '2026-09-01T00:00:00Z',
};

function harness() {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  /** @type {{ kind: string, id: string, payload: unknown }[]} */
  const changes = [];
  const repository = createPoolRepository(database, { onChange: change => changes.push(change) });
  return { database, repository, changes };
}

test('saveBooking notifică onChange cu programarea salvată, în aceeași tranzacție ca scrierea', () => {
  const { repository, changes } = harness();

  const saved = repository.saveBooking(BOOKING);

  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0], { kind: 'pool_bookings', id: 'PB-1', payload: saved });
});

test('un onChange care aruncă anulează și scrierea programării (aceeași tranzacție)', () => {
  const { database, repository } = harness();
  const throwingRepository = createPoolRepository(database, {
    onChange: () => {
      throw new Error('coada plină');
    },
  });

  assert.throws(() => throwingRepository.saveBooking(BOOKING), /coada plină/);
  assert.equal(repository.findBooking('PB-1'), null);
});

test('applySessionChanges notifică onChange per ședință, cu payload null la ștergere', () => {
  const { repository, changes } = harness();
  repository.saveBooking(BOOKING);
  changes.length = 0;

  repository.applySessionChanges([{ bookingId: 'PB-1', date: '2026-09-08', status: 'present' }], () => 'now');
  assert.equal(changes.length, 1);
  assert.equal(changes[0].kind, 'pool_sessions');
  assert.equal(changes[0].id, 'PB-1|2026-09-08');
  assert.deepEqual(changes[0].payload, { bookingId: 'PB-1', date: '2026-09-08', status: 'present', updatedAt: 'now' });

  repository.applySessionChanges([{ bookingId: 'PB-1', date: '2026-09-08', status: null }], () => 'now2');
  assert.equal(changes[1].payload, null);
});

test('saveClosing notifică onChange cu luna și data închiderii', () => {
  const { repository, changes } = harness();

  repository.saveClosing('2026-09', '2026-09-30T12:00:00Z');

  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0], {
    kind: 'pool_closings',
    id: '2026-09',
    payload: { month: '2026-09', closedAt: '2026-09-30T12:00:00Z' },
  });
});

test('onChange e opțional — repository fără el funcționează normal (compatibilitate)', () => {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  const repository = createPoolRepository(database);

  assert.doesNotThrow(() => repository.saveBooking(BOOKING));
  assert.doesNotThrow(() =>
    repository.applySessionChanges([{ bookingId: 'PB-1', date: '2026-09-08', status: 'present' }], () => 'now'),
  );
  assert.doesNotThrow(() => repository.saveClosing('2026-09', '2026-09-30T00:00:00Z'));
});
