import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { createSyncOutboxRepository } from './sync-outbox.repository.mjs';
import { createOutboxRecordingRepository, createChangeSink } from './outbox-recording-repository.mjs';

function createHarness({ enabled = true } = {}) {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  const raw = createRecordRepository(database);
  const outbox = createSyncOutboxRepository(database, { now: () => new Date('2026-09-27T10:00:00.000Z') });
  const recordRepository = createOutboxRecordingRepository(raw, outbox, () => enabled);
  return { database, raw, outbox, recordRepository };
}

test('save pune în outbox doar când înregistrarea chiar diferă', () => {
  const { outbox, recordRepository } = createHarness();

  recordRepository.save('children', { id: 'CHILD-1', name: 'Ana' });
  assert.equal(outbox.countPending(), 1);

  recordRepository.save('children', { id: 'CHILD-1', name: 'Ana' });
  assert.equal(outbox.countPending(), 1);

  recordRepository.save('children', { id: 'CHILD-1', name: 'Ana Pop' });
  assert.equal(outbox.countPending(), 1);
  assert.deepEqual(outbox.pending()[0].payload, { id: 'CHILD-1', name: 'Ana Pop' });
});

test('remove pune o ștergere în outbox, cu payload null', () => {
  const { recordRepository, outbox } = createHarness();
  recordRepository.save('children', { id: 'CHILD-1', name: 'Ana' });
  outbox.remove(outbox.pending()[0].seq);

  recordRepository.remove('children', 'CHILD-1');

  assert.equal(recordRepository.find('children', 'CHILD-1'), undefined);
  const [change] = outbox.pending();
  assert.equal(change.kind, 'children');
  assert.equal(change.recordId, 'CHILD-1');
  assert.equal(change.payload, null);
});

test('cu sincronizarea neconfigurată nu se scrie nimic în outbox, dar înregistrarea se salvează la fel ca astăzi', () => {
  const { recordRepository, outbox } = createHarness({ enabled: false });

  recordRepository.save('children', { id: 'CHILD-1', name: 'Ana' });
  recordRepository.remove('children', 'CHILD-1');

  assert.equal(outbox.countPending(), 0);
});

test('createChangeSink respectă aceeași activare ca depozitul de outbox', () => {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  const outbox = createSyncOutboxRepository(database);
  let enabled = false;
  const changeSink = createChangeSink({ outbox, isEnabled: () => enabled });

  changeSink.record('children', 'CHILD-1', { id: 'CHILD-1' });
  assert.equal(outbox.countPending(), 0);

  enabled = true;
  changeSink.record('children', 'CHILD-1', { id: 'CHILD-1' });
  assert.equal(outbox.countPending(), 1);
});
