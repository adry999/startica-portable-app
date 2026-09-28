import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { createSyncStateRepository } from './sync-state.repository.mjs';
import { createSettingsRepository } from '#core/server/settings/settings-repository.mjs';
import { readLocalSnapshot, writeLocalSnapshot } from './snapshot-io.mjs';

function harness() {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  return database;
}

test('readLocalSnapshot citește toate tipurile de înregistrări ca entries plate, cu updatedAt', () => {
  const database = harness();
  const raw = createRecordRepository(database);
  raw.save('children', { id: 'CHILD-1', name: 'Ana' });
  raw.save('groups', { id: 'GRP-1', name: 'Fluturași' });

  const snapshot = readLocalSnapshot(database, { now: () => new Date('2026-09-28T10:00:00.000Z') });

  assert.equal(snapshot.entries.length, 2);
  const child = snapshot.entries.find(entry => entry.kind === 'children');
  assert.deepEqual(child, {
    kind: 'children',
    id: 'CHILD-1',
    payload: { id: 'CHILD-1', name: 'Ana' },
    updatedAt: '2026-09-28T10:00:00.000Z',
  });
});

test('readLocalSnapshot pe o bază goală întoarce o listă goală', () => {
  const database = harness();
  const snapshot = readLocalSnapshot(database, { now: () => new Date() });
  assert.deepEqual(snapshot.entries, []);
});

test('writeLocalSnapshot scrie brut fiecare înregistrare și sync_state-ul ei, plus cursorul sync.since', () => {
  const database = harness();
  const raw = createRecordRepository(database);
  const syncState = createSyncStateRepository(database);
  const settings = createSettingsRepository(database);

  writeLocalSnapshot(database, {
    records: {
      children: [{ id: 'CHILD-1', revision: 1, payload: { id: 'CHILD-1', name: 'Ana' }, updatedAt: '2026-09-01T00:00:00.000Z' }],
      groups: [{ id: 'GRP-1', revision: 3, payload: { id: 'GRP-1', name: 'Fluturași' }, updatedAt: '2026-09-02T00:00:00.000Z' }],
    },
    headSeq: 42,
  });

  assert.deepEqual(raw.find('children', 'CHILD-1'), { id: 'CHILD-1', name: 'Ana' });
  assert.deepEqual(raw.find('groups', 'GRP-1'), { id: 'GRP-1', name: 'Fluturași' });
  assert.deepEqual(syncState.get('groups', 'GRP-1'), {
    kind: 'groups',
    id: 'GRP-1',
    serverRevision: 3,
    updatedAt: '2026-09-02T00:00:00.000Z',
    updatedByDevice: '',
    updatedByName: '',
  });
  assert.equal(settings.setting('sync.since'), '42');
});

test('writeLocalSnapshot pe un instantaneu gol nu scrie nimic și lasă cursorul la headSeq', () => {
  const database = harness();
  const settings = createSettingsRepository(database);

  writeLocalSnapshot(database, { records: {}, headSeq: 0 });

  assert.equal(settings.setting('sync.since'), '0');
});
