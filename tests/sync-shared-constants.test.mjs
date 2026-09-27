import test from 'node:test';
import assert from 'node:assert/strict';
import { SENSITIVE_FIELDS, TYPES } from '#shared/domain/record-schema.mjs';
import { RECORD_KINDS, SENSITIVE_FIELDS as SYNC_SENSITIVE_FIELDS } from '#sync-server/change-policy.mjs';

// sync-server/ nu importă nimic din src/ (decizia 1 din plan), deci cele două constante
// sensibile sunt copii; acest test la rădăcină e singurul loc care le ține sincronizate.
test('constantele copiate în sync-server/change-policy.mjs rămân identice cu #shared/domain/record-schema.mjs', () => {
  assert.deepEqual(RECORD_KINDS, TYPES);
  assert.deepEqual(SYNC_SENSITIVE_FIELDS, SENSITIVE_FIELDS);
});
