import test from 'node:test';
import assert from 'node:assert/strict';
import { selectExpiredHealthNotes } from './visit-health-notes.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Visit} Visit */
/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */

/** @returns {Visit} */
function buildVisit(overrides = {}) {
  return {
    id: 'VIZ-1',
    name: 'Ana Popescu',
    parent: 'Maria Popescu',
    date: '2026-09-10',
    time: '10:00',
    status: 'Programată',
    statusChangedAt: '2026-09-01T10:00:00.000Z',
    history: [],
    desiredGroupId: null,
    childId: '',
    healthNotes: '',
    ...overrides,
  };
}

/** @returns {Child} */
function buildChild(overrides = {}) {
  return {
    id: 'C-1',
    name: 'Ana Popescu',
    parent: 'Maria Popescu',
    phone: '0722000000',
    groupId: null,
    status: 'Activ',
    statusHistory: [],
    fee: null,
    feeHistory: [],
    dueDay: 10,
    healthNotes: '',
    archived: false,
    ...overrides,
  };
}

test('selectExpiredHealthNotes alege vizitele cu note medicale mai vechi de 365 de zile de la schimbarea de statut', () => {
  const snapshot = {
    visits: [
      buildVisit({ id: 'VIZ-364', healthNotes: 'alergie', statusChangedAt: '2025-09-11T10:00:00.000Z' }),
      buildVisit({ id: 'VIZ-365', healthNotes: 'alergie', statusChangedAt: '2025-09-10T10:00:00.000Z' }),
      buildVisit({ id: 'VIZ-gol', healthNotes: '', statusChangedAt: '2020-01-01T10:00:00.000Z' }),
    ],
    children: [],
  };

  const result = selectExpiredHealthNotes(snapshot, '2026-09-10');

  assert.deepEqual(result.visits, ['VIZ-365']);
});

test('selectExpiredHealthNotes alege copiii arhivați cu note medicale mai vechi de 365 de zile de la arhivare', () => {
  const snapshot = {
    visits: [],
    children: [
      buildChild({ id: 'C-364', healthNotes: 'alergie', archived: true, archivedAt: '2025-09-11T10:00:00.000Z' }),
      buildChild({ id: 'C-365', healthNotes: 'alergie', archived: true, archivedAt: '2025-09-10T10:00:00.000Z' }),
      buildChild({ id: 'C-neactiv', healthNotes: 'alergie', archived: false, archivedAt: '2020-01-01T10:00:00.000Z' }),
      buildChild({ id: 'C-gol', healthNotes: '', archived: true, archivedAt: '2020-01-01T10:00:00.000Z' }),
    ],
  };

  const result = selectExpiredHealthNotes(snapshot, '2026-09-10');

  assert.deepEqual(result.children, ['C-365']);
});
