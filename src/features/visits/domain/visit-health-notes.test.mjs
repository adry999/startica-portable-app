import test from 'node:test';
import assert from 'node:assert/strict';
import { selectExpiredHealthNotes } from './visit-health-notes.mjs';

test('selectExpiredHealthNotes alege vizitele cu note medicale mai vechi de 365 de zile de la schimbarea de statut', () => {
  const snapshot = {
    visits: [
      { id: 'VIZ-364', healthNotes: 'alergie', statusChangedAt: '2025-09-11T10:00:00.000Z' },
      { id: 'VIZ-365', healthNotes: 'alergie', statusChangedAt: '2025-09-10T10:00:00.000Z' },
      { id: 'VIZ-gol', healthNotes: '', statusChangedAt: '2020-01-01T10:00:00.000Z' },
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
      { id: 'C-364', healthNotes: 'alergie', archived: true, archivedAt: '2025-09-11T10:00:00.000Z' },
      { id: 'C-365', healthNotes: 'alergie', archived: true, archivedAt: '2025-09-10T10:00:00.000Z' },
      { id: 'C-neactiv', healthNotes: 'alergie', archived: false, archivedAt: '2020-01-01T10:00:00.000Z' },
      { id: 'C-gol', healthNotes: '', archived: true, archivedAt: '2020-01-01T10:00:00.000Z' },
    ],
  };

  const result = selectExpiredHealthNotes(snapshot, '2026-09-10');

  assert.deepEqual(result.children, ['C-365']);
});
