import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { createSyncConflictsRepository } from './sync-conflicts.repository.mjs';

function createRepository() {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  return createSyncConflictsRepository(database, { now: () => new Date('2026-09-27T10:00:00.000Z') });
}

const SAMPLE = {
  kind: 'children',
  recordId: 'CHILD-1',
  localPayload: { id: 'CHILD-1', name: 'Ana Local' },
  localUpdatedAt: '2026-09-27T09:00:00.000Z',
  remotePayload: { id: 'CHILD-1', name: 'Ana Remote' },
  remoteRevision: 4,
  remoteUpdatedAt: '2026-09-27T09:05:00.000Z',
  remoteDeviceId: 'dev-2',
  remoteDeviceName: 'Calculator B',
  outboxSeq: 7,
};

test('insert scrie ambele variante, find le citește înapoi identic', () => {
  const repository = createRepository();
  const id = repository.insert(SAMPLE);

  const found = repository.find(id);
  assert.ok(found);
  assert.equal(found?.kind, 'children');
  assert.deepEqual(found?.localPayload, SAMPLE.localPayload);
  assert.deepEqual(found?.remotePayload, SAMPLE.remotePayload);
  assert.equal(found?.remoteDeviceName, 'Calculator B');
  assert.equal(found?.outboxSeq, 7);
  assert.equal(found?.createdAt, '2026-09-27T10:00:00.000Z');
});

test('o parte ștearsă se păstrează cu payload null', () => {
  const repository = createRepository();
  const id = repository.insert({ ...SAMPLE, remotePayload: null });

  assert.equal(repository.find(id)?.remotePayload, null);
});

test('list și count reflectă toate conflictele înregistrate', () => {
  const repository = createRepository();
  repository.insert(SAMPLE);
  repository.insert({ ...SAMPLE, recordId: 'CHILD-2' });

  assert.equal(repository.count(), 2);
  assert.deepEqual(
    repository.list().map(conflict => conflict?.recordId),
    ['CHILD-1', 'CHILD-2'],
  );
});

test('remove scoate conflictul din listă', () => {
  const repository = createRepository();
  const id = repository.insert(SAMPLE);

  repository.remove(id);

  assert.equal(repository.count(), 0);
  assert.equal(repository.find(id), undefined);
});
