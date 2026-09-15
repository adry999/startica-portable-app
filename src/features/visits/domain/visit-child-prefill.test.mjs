import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChildPrefill } from './visit-child-prefill.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Visit} Visit */

/**
 * @param {Record<string, unknown>} [overrides]
 * @returns {Visit}
 */
function buildVisit(overrides = {}) {
  return /** @type {any} */ ({
    id: 'VIZ-1',
    name: 'Ana Popescu',
    birthDate: '2022-03-01',
    parent: 'Maria Popescu',
    phone: '0722000000',
    parent2: 'Ion Popescu',
    phone2: '0733000000',
    date: '2026-09-10',
    time: '10:00',
    status: 'Efectuată',
    statusChangedAt: '2026-09-10T10:30:00.000Z',
    history: [],
    desiredStartDate: '2026-10-01',
    desiredGroupId: 'GRP-1',
    source: '',
    healthNotes: '',
    postVisitNotes: '',
    childId: '',
    ...overrides,
  });
}

test('mapează câmpurile vizitei pe câmpurile fișei copilului', () => {
  const visit = buildVisit();

  const prefill = buildChildPrefill(visit);

  assert.equal(prefill.name, visit.name);
  assert.equal(prefill.birthDate, visit.birthDate);
  assert.equal(prefill.parent, visit.parent);
  assert.equal(prefill.phone, visit.phone);
  assert.equal(prefill.parent2, visit.parent2);
  assert.equal(prefill.phone2, visit.phone2);
  assert.equal(prefill.groupId, visit.desiredGroupId);
  assert.equal(prefill.attendanceDate, visit.desiredStartDate);
  assert.equal(prefill.healthNotes, visit.healthNotes);
});

test('notes combină sursa și observațiile după vizită pe rânduri separate când ambele există', () => {
  const visit = buildVisit({ source: 'Recomandare', postVisitNotes: 'Foarte interesată de grupa mare.' });

  const prefill = buildChildPrefill(visit);

  assert.equal(prefill.notes, 'Sursă: Recomandare\nFoarte interesată de grupa mare.');
});

test('notes conține doar sursa când observațiile după vizită lipsesc', () => {
  const visit = buildVisit({ source: 'Recomandare', postVisitNotes: '' });

  assert.equal(buildChildPrefill(visit).notes, 'Sursă: Recomandare');
});

test('notes conține doar observațiile după vizită când sursa lipsește', () => {
  const visit = buildVisit({ source: '', postVisitNotes: 'Foarte interesată de grupa mare.' });

  assert.equal(buildChildPrefill(visit).notes, 'Foarte interesată de grupa mare.');
});

test('notes este gol când nici sursa, nici observațiile după vizită nu există', () => {
  const visit = buildVisit({ source: '', postVisitNotes: '' });

  assert.equal(buildChildPrefill(visit).notes, '');
});

test('notes ignoră câmpurile care conțin doar spații', () => {
  const visit = buildVisit({ source: '   ', postVisitNotes: '   ' });

  assert.equal(buildChildPrefill(visit).notes, '');
});
