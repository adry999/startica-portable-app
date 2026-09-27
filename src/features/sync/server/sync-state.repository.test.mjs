import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { createSyncStateRepository } from './sync-state.repository.mjs';

function createRepository() {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  return createSyncStateRepository(database);
}

test('get pe o înregistrare necunoscută întoarce undefined', () => {
  const repository = createRepository();
  assert.equal(repository.get('children', 'CHILD-1'), undefined);
});

test('set scrie și get citește exact ce s-a scris', () => {
  const repository = createRepository();
  repository.set('children', 'CHILD-1', {
    serverRevision: 3,
    updatedAt: '2026-09-27T10:00:00.000Z',
    updatedByDevice: 'dev-1',
    updatedByName: 'Calculator A',
  });

  assert.deepEqual(repository.get('children', 'CHILD-1'), {
    kind: 'children',
    id: 'CHILD-1',
    serverRevision: 3,
    updatedAt: '2026-09-27T10:00:00.000Z',
    updatedByDevice: 'dev-1',
    updatedByName: 'Calculator A',
  });
});

test('un al doilea set pe aceeași înregistrare o actualizează, nu adaugă un rând nou', () => {
  const repository = createRepository();
  repository.set('children', 'CHILD-1', {
    serverRevision: 1,
    updatedAt: '2026-09-27T10:00:00.000Z',
    updatedByDevice: 'dev-1',
  });
  repository.set('children', 'CHILD-1', {
    serverRevision: 2,
    updatedAt: '2026-09-27T11:00:00.000Z',
    updatedByDevice: 'dev-2',
    updatedByName: 'Calculator B',
  });

  assert.equal(repository.get('children', 'CHILD-1')?.serverRevision, 2);
  assert.equal(repository.get('children', 'CHILD-1')?.updatedByName, 'Calculator B');
});

test('setMany scrie mai multe intrări dintr-un lot de pull', () => {
  const repository = createRepository();
  repository.setMany([
    {
      kind: 'children',
      id: 'CHILD-1',
      serverRevision: 1,
      updatedAt: '2026-09-27T10:00:00.000Z',
      updatedByDevice: 'dev-1',
    },
    {
      kind: 'payments',
      id: 'PAY-1',
      serverRevision: 1,
      updatedAt: '2026-09-27T10:00:00.000Z',
      updatedByDevice: 'dev-1',
    },
  ]);

  assert.equal(repository.get('children', 'CHILD-1')?.serverRevision, 1);
  assert.equal(repository.get('payments', 'PAY-1')?.serverRevision, 1);
});
