import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState } from './record-schema.mjs';
import { upgradeSnapshot } from './record-snapshot-upgrade.mjs';
import { DEFAULT_EXPENSE_CATEGORY_SEEDS } from './expense-categories.mjs';

test('un copil cu câmp text group primește o grupă nouă și groupId', () => {
  const input = {
    ...emptyState(),
    categories: [{ id: 'CAT-general', name: 'General' }],
    children: [{ id: 'C1', name: 'Ana', group: 'Fluturași' }],
  };

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
    categories: [{ id: 'CAT-general', name: 'General' }],
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

test('un instantaneu app_state fără listele groups și categories este acceptat, iar categoriile implicite se completează', () => {
  const { snapshot, notes } = upgradeSnapshot({ children: [{ id: 'C1', name: 'Ana' }], payments: [], expenses: [] });

  assert.deepEqual(snapshot.groups, []);
  assert.equal(snapshot.categories.length, DEFAULT_EXPENSE_CATEGORY_SEEDS.length);
  assert.deepEqual(snapshot.children, [{ id: 'C1', name: 'Ana' }]);
  assert.ok(notes.some(note => note.includes('Categorii implicite completate')));
});

test('un tip de înregistrare necunoscut este ignorat, cu o notă, nu aruncă', () => {
  const { snapshot, notes } = upgradeSnapshot({ ...emptyState(), archive: [{ id: 'X1' }, { id: 'X2' }] });

  assert.deepEqual(snapshot.children, []);
  assert.deepEqual(snapshot.categories, DEFAULT_EXPENSE_CATEGORY_SEEDS);
  assert.deepEqual(notes, [
    'Tip necunoscut ignorat: archive (2 înregistrări).',
    `Categorii implicite completate: ${DEFAULT_EXPENSE_CATEGORY_SEEDS.length} (inclusiv „General”, dacă lipsea).`,
  ]);
});

test('un instantaneu deja în formatul curent, cu toate categoriile implicite prezente, rămâne neschimbat, fără note', () => {
  const current = {
    ...emptyState(),
    groups: [{ id: 'GRP-1', name: 'Fluturași', capacity: null }],
    children: [{ id: 'C1', name: 'Ana', groupId: 'GRP-1' }],
    categories: [{ id: 'CAT-general', name: 'General' }],
  };

  const { snapshot, notes } = upgradeSnapshot(current);

  assert.deepEqual(snapshot, current);
  assert.deepEqual(notes, []);
});

test('un instantaneu fără categorii (export vechi, dinainte ca ele să fie reale) primește categoriile implicite', () => {
  const { snapshot, notes } = upgradeSnapshot({ ...emptyState(), children: [{ id: 'C1', name: 'Ana' }] });

  assert.ok(snapshot.categories.some(category => category.id === 'CAT-general' && category.name === 'General'));
  assert.equal(snapshot.categories.length, DEFAULT_EXPENSE_CATEGORY_SEEDS.length);
  assert.ok(notes.some(note => note.includes('Categorii implicite completate')));
});

test('o cheltuială cu o categorie fără înregistrare corespunzătoare primește o categorie nouă la import', () => {
  const input = {
    ...emptyState(),
    categories: [{ id: 'CAT-general', name: 'General' }],
    expenses: [{ id: 'EXP-1', date: '2026-01-01', category: 'Rechizite școlare', description: '', amount: 10 }],
  };

  const { snapshot, notes } = upgradeSnapshot(input);

  assert.ok(snapshot.categories.some(category => category.name === 'Rechizite școlare'));
  assert.ok(notes.some(note => note.includes('Rechizite școlare')));
});
