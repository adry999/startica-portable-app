import test from 'node:test';
import assert from 'node:assert/strict';
import {
  weekStartOf,
  weekdaysOf,
  computePresentWeekFill,
  computeCopyPreviousWeekFill,
} from './timesheet-week-fill.mjs';

test('weekStartOf întoarce lunea săptămânii, inclusiv când data e o duminică', () => {
  assert.equal(weekStartOf('2026-09-09'), '2026-09-07'); // miercuri
  assert.equal(weekStartOf('2026-09-07'), '2026-09-07'); // deja luni
  assert.equal(weekStartOf('2026-09-13'), '2026-09-07'); // duminică
});

test('weekdaysOf întoarce luni-vineri, în ordine', () => {
  assert.deepEqual(weekdaysOf('2026-09-07'), ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']);
});

test('computePresentWeekFill completează doar celulele goale, sare peste weekend/sărbători', () => {
  const existing = new Set(['STF-1|2026-09-08']); // marți deja marcată
  const changes = computePresentWeekFill({
    staffIds: ['STF-1'],
    weekStart: '2026-09-07',
    hasRow: (staffId, date) => existing.has(`${staffId}|${date}`),
  });
  assert.deepEqual(
    changes.map(change => change.date),
    ['2026-09-07', '2026-09-09', '2026-09-10', '2026-09-11'],
  );
  assert.ok(changes.every(change => change.code === 'P'));
});

test('computePresentWeekFill nu scrie nimic peste o săptămână deja complet marcată', () => {
  const existing = new Set(weekdaysOf('2026-09-07').map(date => `STF-1|${date}`));
  const changes = computePresentWeekFill({
    staffIds: ['STF-1'],
    weekStart: '2026-09-07',
    hasRow: (staffId, date) => existing.has(`${staffId}|${date}`),
  });
  assert.deepEqual(changes, []);
});

test('computePresentWeekFill acoperă mai mulți angajați, fiecare independent', () => {
  const existing = new Set(['STF-2|2026-09-07']);
  const changes = computePresentWeekFill({
    staffIds: ['STF-1', 'STF-2'],
    weekStart: '2026-09-07',
    hasRow: (staffId, date) => existing.has(`${staffId}|${date}`),
  });
  assert.equal(changes.filter(change => change.staffId === 'STF-1').length, 5);
  assert.equal(changes.filter(change => change.staffId === 'STF-2').length, 4);
});

test('computeCopyPreviousWeekFill copiază codul din aceeași zi a săptămânii trecute, doar în celule goale', () => {
  /** @type {Map<string, import('../personal.types.d.mts').TimesheetCode>} */
  const previousCodes = new Map([
    ['STF-1|2026-08-31', 'CO'], // luni săpt. trecută
    ['STF-1|2026-09-02', 'A'], // miercuri săpt. trecută
  ]);
  const currentExisting = new Set(['STF-1|2026-09-08']); // marți curentă deja marcată

  const changes = computeCopyPreviousWeekFill({
    staffIds: ['STF-1'],
    weekStart: '2026-09-07',
    hasRow: (staffId, date) => currentExisting.has(`${staffId}|${date}`),
    readCode: (staffId, date) => previousCodes.get(`${staffId}|${date}`) ?? null,
  });

  assert.deepEqual(changes, [
    { staffId: 'STF-1', date: '2026-09-07', code: 'CO' },
    { staffId: 'STF-1', date: '2026-09-09', code: 'A' },
  ]);
});

test('computeCopyPreviousWeekFill cu date parțiale în sursă nu scrie nimic pentru zilele fără cod anterior', () => {
  const previousCodes = new Map(); // săptămâna trecută complet goală (lucrat)
  const changes = computeCopyPreviousWeekFill({
    staffIds: ['STF-1'],
    weekStart: '2026-09-07',
    hasRow: () => false,
    readCode: (staffId, date) => previousCodes.get(`${staffId}|${date}`) ?? null,
  });
  assert.deepEqual(changes, []);
});

test('completarea pe un singur angajat (rândul) se poate scopa cu o listă de un element', () => {
  const changes = computePresentWeekFill({
    staffIds: ['STF-1'],
    weekStart: '2026-09-07',
    hasRow: () => false,
  });
  assert.ok(changes.every(change => change.staffId === 'STF-1'));
  assert.equal(changes.length, 5);
});
