import test from 'node:test';
import assert from 'node:assert/strict';
import { coalesceOutboxChange } from './change-coalescing.mjs';

test('fără un rând pending, schimbarea curentă devine primul rând', () => {
  const result = coalesceOutboxChange(undefined, { baseRevision: 3, payload: { id: 'CHILD-1' } });
  assert.deepEqual(result, { baseRevision: 3, payload: { id: 'CHILD-1' } });
});

test('cu un rând pending, revizia de bază rămâne prima, dar payload-ul e cel nou', () => {
  const pending = { baseRevision: 3, payload: { id: 'CHILD-1', name: 'Ana' } };
  const result = coalesceOutboxChange(pending, { baseRevision: 5, payload: { id: 'CHILD-1', name: 'Ana Pop' } });
  assert.deepEqual(result, { baseRevision: 3, payload: { id: 'CHILD-1', name: 'Ana Pop' } });
});

test('o ștergere (payload null) coalesce la fel ca orice altă schimbare', () => {
  const pending = { baseRevision: 1, payload: { id: 'CHILD-1' } };
  const result = coalesceOutboxChange(pending, { baseRevision: 2, payload: null });
  assert.deepEqual(result, { baseRevision: 1, payload: null });
});
