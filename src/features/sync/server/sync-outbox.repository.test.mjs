import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { createSyncOutboxRepository } from './sync-outbox.repository.mjs';

function createRepository() {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  return {
    database,
    outbox: createSyncOutboxRepository(database, { now: () => new Date('2026-09-27T10:00:00.000Z') }),
  };
}

test('enqueue scrie un rând pending cu revizia de bază 0, fără sync_state', () => {
  const { outbox } = createRepository();
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Ana' } });

  const [change] = outbox.pending();
  assert.equal(change.kind, 'children');
  assert.equal(change.recordId, 'CHILD-1');
  assert.equal(change.baseRevision, 0);
  assert.deepEqual(change.payload, { id: 'CHILD-1', name: 'Ana' });
  assert.equal(change.status, 'pending');
});

test('enqueue ia revizia de bază din sync_state, când există', () => {
  const { database, outbox } = createRepository();
  database
    .prepare('INSERT INTO sync_state VALUES(?,?,?,?,?,?)')
    .run('children', 'CHILD-1', 4, '2026-09-27T09:00:00.000Z', 'dev-1', 'Calculator A');

  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Ana' } });

  assert.equal(outbox.pending()[0].baseRevision, 4);
});

test('două modificări ale aceleiași fișe rămân un singur rând pending, cu ultimul payload și prima revizie de bază', () => {
  const { outbox } = createRepository();
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Ana' } });
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Ana Pop' } });

  const pending = outbox.pending();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].baseRevision, 0);
  assert.deepEqual(pending[0].payload, { id: 'CHILD-1', name: 'Ana Pop' });
  assert.equal(outbox.countPending(), 1);
});

test('o ștergere pune un rând cu payload null', () => {
  const { outbox } = createRepository();
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: null });

  assert.equal(outbox.pending()[0].payload, null);
});

test('markSent, park și unpark mută rândul în afara sau înapoi în pending', () => {
  const { outbox } = createRepository();
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1' } });
  const [{ seq }] = outbox.pending();

  outbox.park(seq);
  assert.equal(outbox.pending().length, 0);

  outbox.unpark(seq, 7);
  const [reparked] = outbox.pending();
  assert.equal(reparked.baseRevision, 7);
  assert.equal(reparked.status, 'pending');

  outbox.markSent([seq]);
  assert.equal(outbox.pending().length, 0);
});

test('remove șterge definitiv rândul', () => {
  const { outbox } = createRepository();
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1' } });
  const [{ seq }] = outbox.pending();

  outbox.remove(seq);

  assert.equal(outbox.countPending(), 0);
});

test('pending respectă limita și ordinea de inserare', () => {
  const { outbox } = createRepository();
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1' } });
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-2', payload: { id: 'CHILD-2' } });
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-3', payload: { id: 'CHILD-3' } });

  const firstTwo = outbox.pending(2);
  assert.deepEqual(
    firstTwo.map(change => change.recordId),
    ['CHILD-1', 'CHILD-2'],
  );
});
