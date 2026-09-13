import test from 'node:test';
import assert from 'node:assert/strict';
import { listChangedFields } from './audit-change-diff.mjs';

test('o înregistrare nouă listează toate câmpurile', () => {
  assert.deepEqual(listChangedFields(null, { id: 'GRP-1', name: 'Curcubeu' }), [
    { field: 'id', before: null, after: 'GRP-1' },
    { field: 'name', before: null, after: 'Curcubeu' },
  ]);
});

test('câmpurile neschimbate lipsesc, iar istoricele se compară după valoare', () => {
  const before = { id: 'CHILD-1', name: 'Ana', feeHistory: [{ from: '2026-09', amount: 1500 }] };
  const after = { id: 'CHILD-1', name: 'Ana', feeHistory: [{ from: '2026-09', amount: 1700 }] };

  assert.deepEqual(listChangedFields(before, after), [
    { field: 'feeHistory', before: before.feeHistory, after: after.feeHistory },
  ]);
});

test('ștergerea unui câmp apare ca schimbare către null', () => {
  assert.deepEqual(listChangedFields({ notes: 'de sunat' }, {}), [{ field: 'notes', before: 'de sunat', after: null }]);
});
