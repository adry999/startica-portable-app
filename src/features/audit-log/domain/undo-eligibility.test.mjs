import test from 'node:test';
import assert from 'node:assert/strict';
import { checkUndoEligibility, restoreValueForUndo, UNDO_WINDOW_MS } from './undo-eligibility.mjs';

const baseEntry = {
  recordType: 'expenses',
  recordId: 'E1',
  after: { id: 'E1', amount: 100 },
  occurredAt: '2026-10-02T10:00:00.000Z',
  sessionToken: 'TOKEN-A',
};

const baseParams = {
  entry: baseEntry,
  now: new Date('2026-10-02T10:00:05.000Z'),
  currentSessionToken: 'TOKEN-A',
  currentRecord: { id: 'E1', amount: 100 },
};

test('în fereastra de 15 secunde, de pe același calculator, fără modificări ulterioare — eligibil', () => {
  assert.deepEqual(checkUndoEligibility(baseParams), { ok: true });
});

test('exact la limita ferestrei (15000ms) — încă eligibil', () => {
  const result = checkUndoEligibility({
    ...baseParams,
    now: new Date(new Date(baseEntry.occurredAt).getTime() + UNDO_WINDOW_MS),
  });
  assert.deepEqual(result, { ok: true });
});

test('peste fereastra de 15 secunde — respins (409)', () => {
  const result = checkUndoEligibility({
    ...baseParams,
    now: new Date(new Date(baseEntry.occurredAt).getTime() + UNDO_WINDOW_MS + 1),
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.match(result.message, /Fereastra/);
});

test('un „now" dinainte de acțiune (ceas dat peste cap) — respins, nu acceptat implicit', () => {
  const result = checkUndoEligibility({ ...baseParams, now: new Date('2026-10-02T09:59:00.000Z') });
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
});

test('de pe alt calculator (sessionToken diferit) — respins (403)', () => {
  const result = checkUndoEligibility({ ...baseParams, currentSessionToken: 'TOKEN-B' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.match(result.message, /același calculator/);
});

test('fără sessionToken curent (context fără sesiune) — respins (403)', () => {
  const result = checkUndoEligibility({ ...baseParams, currentSessionToken: null });
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
});

test('înregistrarea a fost modificată între timp — respins (409, „S-a modificat între timp”)', () => {
  const result = checkUndoEligibility({ ...baseParams, currentRecord: { id: 'E1', amount: 999 } });
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.match(result.message, /S-a modificat între timp/);
});

test('înregistrarea a fost ștearsă între timp (current null, after nenul) — respins (409)', () => {
  const result = checkUndoEligibility({ ...baseParams, currentRecord: null });
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
});

test('o intrare fără recordType/recordId (ex. configurare backup) — nu poate fi anulată (409)', () => {
  const result = checkUndoEligibility({
    ...baseParams,
    entry: { ...baseEntry, recordType: null, recordId: null },
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.match(result.message, /nu poate fi anulată/);
});

test('o intrare inexistentă — 404', () => {
  const result = checkUndoEligibility({ ...baseParams, entry: null });
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
});

test('restoreValueForUndo: păstrează healthNotes curent, nu placeholder-ul redactat din „before”', () => {
  const before = { id: 'C1', name: 'Vechi', healthNotes: '[date medicale]' };
  const currentRecord = { id: 'C1', name: 'Nou', healthNotes: 'Alergie la nuci' };

  const restored = restoreValueForUndo('children', before, currentRecord);

  assert.equal(restored.name, 'Vechi');
  assert.equal(restored.healthNotes, 'Alergie la nuci');
});

test('restoreValueForUndo: tip fără câmpuri sensibile — before neschimbat', () => {
  const before = { id: 'E1', amount: 100 };
  assert.deepEqual(restoreValueForUndo('expenses', before, { id: 'E1', amount: 999 }), before);
});

test('restoreValueForUndo: fără înregistrare curentă (a fost ștearsă) — before neschimbat', () => {
  const before = { id: 'C1', healthNotes: '[date medicale]' };
  assert.deepEqual(restoreValueForUndo('children', before, null), before);
});
