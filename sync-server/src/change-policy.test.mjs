import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFLICT_KINDS, isLastWriterWins, KINDS } from './change-policy.mjs';

test('fișele, grupele, categoriile și vizitele intră în conflict, restul sunt last-writer-wins', () => {
  for (const kind of CONFLICT_KINDS) assert.equal(isLastWriterWins(kind), false, kind);
  for (const kind of KINDS.filter(k => !CONFLICT_KINDS.includes(k))) assert.equal(isLastWriterWins(kind), true, kind);
});

test('KINDS conține toate tipurile de fișe plus prezența, șabloanele SMS și setările', () => {
  assert.deepEqual(KINDS, [
    'children',
    'payments',
    'expenses',
    'groups',
    'categories',
    'visits',
    'charges',
    'attendance',
    'sms_templates',
    'settings',
  ]);
});
