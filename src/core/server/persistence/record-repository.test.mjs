import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '../database/schema.mjs';
import { createRecordRepository } from './record-repository.mjs';

function createRepository(t) {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  t.after(() => database.close());
  return { database, recordRepository: createRecordRepository(database) };
}

test('save, find, exists și remove operează pe o singură înregistrare', t => {
  const { recordRepository } = createRepository(t);
  const child = { id: 'CHILD-1', name: 'Ana' };

  assert.equal(recordRepository.exists('children', 'CHILD-1'), false);
  recordRepository.save('children', child);

  assert.equal(recordRepository.exists('children', 'CHILD-1'), true);
  assert.deepEqual(recordRepository.find('children', 'CHILD-1'), child);

  recordRepository.remove('children', 'CHILD-1');
  assert.equal(recordRepository.exists('children', 'CHILD-1'), false);
  assert.equal(recordRepository.find('children', 'CHILD-1'), undefined);
});

test('save cu același id actualizează înregistrarea în loc să o dubleze', t => {
  const { recordRepository } = createRepository(t);
  recordRepository.save('children', { id: 'CHILD-1', name: 'Ana' });
  recordRepository.save('children', { id: 'CHILD-1', name: 'Ana Pop' });

  assert.deepEqual(recordRepository.readSnapshot().children, [{ id: 'CHILD-1', name: 'Ana Pop' }]);
});

test('readSnapshot păstrează ordinea de inserare', t => {
  const { recordRepository } = createRepository(t);
  recordRepository.save('children', { id: 'CHILD-2', name: 'Ioana' });
  recordRepository.save('children', { id: 'CHILD-1', name: 'Ana' });
  recordRepository.save('groups', { id: 'GRP-1', name: 'Grupa mare' });

  const snapshot = recordRepository.readSnapshot();

  assert.deepEqual(
    snapshot.children.map(child => child.id),
    ['CHILD-2', 'CHILD-1'],
  );
  assert.deepEqual(
    snapshot.groups.map(group => group.id),
    ['GRP-1'],
  );
  assert.deepEqual(snapshot.payments, []);
});

test('readEnvelope întoarce starea, revizia și data ultimei actualizări', t => {
  const { recordRepository, database } = createRepository(t);
  recordRepository.save('children', { id: 'CHILD-1', name: 'Ana' });

  const envelope = recordRepository.readEnvelope();

  assert.deepEqual(Object.keys(envelope).sort(), ['revision', 'state', 'updatedAt']);
  assert.equal(envelope.revision, 0);
  assert.deepEqual(envelope.state.children, [{ id: 'CHILD-1', name: 'Ana' }]);
  const metaRow = /** @type {{ revision: number }} */ (database.prepare('SELECT revision FROM meta WHERE id=1').get());
  assert.equal(recordRepository.currentRevision(), metaRow.revision);
});
