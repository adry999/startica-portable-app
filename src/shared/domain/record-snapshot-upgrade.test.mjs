import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState } from './record-schema.mjs';
import { upgradeSnapshot } from './record-snapshot-upgrade.mjs';

test('un copil cu câmp text group primește o grupă nouă și groupId', () => {
  const input = { ...emptyState(), children: [{ id: 'C1', name: 'Ana', group: 'Fluturași' }] };

  const { snapshot, notes } = upgradeSnapshot(input);

  assert.equal(snapshot.groups.length, 1);
  assert.equal(snapshot.groups[0].name, 'Fluturași');
  assert.equal(snapshot.children[0].groupId, snapshot.groups[0].id);
  assert.ok(!('group' in snapshot.children[0]));
  assert.deepEqual(notes, ['Format vechi, actualizat: 1 grupă creată din câmpul text al copiilor.']);
});

test('doi copii cu același nume de grupă text primesc aceeași grupă', () => {
  const input = {
    ...emptyState(),
    children: [
      { id: 'C1', name: 'Ana', group: 'Fluturași' },
      { id: 'C2', name: 'Ion', group: ' Fluturași ' },
      { id: 'C3', name: 'Maria', group: '' },
    ],
  };

  const { snapshot, notes } = upgradeSnapshot(input);

  assert.equal(snapshot.groups.length, 1);
  assert.equal(snapshot.children[0].groupId, snapshot.groups[0].id);
  assert.equal(snapshot.children[1].groupId, snapshot.groups[0].id);
  assert.equal(snapshot.children[2].groupId, null);
  assert.deepEqual(notes, ['Format vechi, actualizat: 1 grupă creată din câmpul text al copiilor.']);
});

test('un instantaneu app_state fără listele groups și categories este acceptat', () => {
  const { snapshot, notes } = upgradeSnapshot({ children: [{ id: 'C1', name: 'Ana' }], payments: [], expenses: [] });

  assert.deepEqual(snapshot.groups, []);
  assert.deepEqual(snapshot.categories, []);
  assert.deepEqual(snapshot.children, [{ id: 'C1', name: 'Ana' }]);
  assert.deepEqual(notes, []);
});

test('un tip de înregistrare necunoscut este ignorat, cu o notă, nu aruncă', () => {
  const { snapshot, notes } = upgradeSnapshot({ ...emptyState(), archive: [{ id: 'X1' }, { id: 'X2' }] });

  assert.deepEqual(snapshot, emptyState());
  assert.deepEqual(notes, ['Tip necunoscut ignorat: archive (2 înregistrări).']);
});

test('un instantaneu deja în formatul curent rămâne neschimbat, fără note', () => {
  const current = {
    ...emptyState(),
    groups: [{ id: 'GRP-1', name: 'Fluturași', capacity: null }],
    children: [{ id: 'C1', name: 'Ana', groupId: 'GRP-1' }],
  };

  const { snapshot, notes } = upgradeSnapshot(current);

  assert.deepEqual(snapshot, current);
  assert.deepEqual(notes, []);
});
