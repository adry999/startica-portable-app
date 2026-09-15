import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedNextStatuses, applyVisitStatus, rescheduleVisit } from './visit-status.mjs';

function buildVisit(overrides = {}) {
  return {
    id: 'VIZ-1',
    name: 'Ana Popescu',
    phone: '0722000000',
    status: 'Programată',
    date: '2026-09-10',
    time: '10:00',
    statusChangedAt: '2026-09-01T10:00:00.000Z',
    history: [{ at: '2026-09-01T10:00:00.000Z', status: 'Programată', date: '2026-09-10', time: '10:00' }],
    ...overrides,
  };
}

test('allowedNextStatuses întoarce tranzițiile permise pentru fiecare statut', () => {
  assert.deepEqual(allowedNextStatuses('Programată'), ['Efectuată', 'Neprezentată', 'Renunțat']);
  assert.deepEqual(allowedNextStatuses('Efectuată'), ['Renunțat']);
  assert.deepEqual(allowedNextStatuses('Neprezentată'), ['Renunțat']);
  assert.deepEqual(allowedNextStatuses('Renunțat'), []);
  assert.deepEqual(allowedNextStatuses('Înscris'), []);
});

test('rescheduleVisit repornește vizita ca Programată din orice statut în afară de Înscris', () => {
  for (const status of ['Programată', 'Efectuată', 'Neprezentată', 'Renunțat']) {
    const visit = buildVisit({ status });
    const updated = rescheduleVisit(visit, { date: '2026-09-20', time: '11:30' }, '2026-09-05T08:00:00.000Z');
    assert.equal(updated.status, 'Programată');
    assert.equal(updated.date, '2026-09-20');
    assert.equal(updated.time, '11:30');
    assert.equal(updated.statusChangedAt, '2026-09-05T08:00:00.000Z');
    assert.equal(updated.history.length, visit.history.length + 1);
    assert.deepEqual(updated.history.at(-1), {
      at: '2026-09-05T08:00:00.000Z',
      status: 'Programată',
      date: '2026-09-20',
      time: '11:30',
    });
    assert.equal(visit.status, status, 'vizita originală rămâne neschimbată');
  }
});

test('rescheduleVisit refuză reprogramarea unei vizite Înscris', () => {
  const visit = buildVisit({ status: 'Înscris' });
  assert.throws(() => rescheduleVisit(visit, { date: '2026-09-20', time: '11:30' }, '2026-09-05T08:00:00.000Z'));
});

test('applyVisitStatus scrie statutul, statusChangedAt și o intrare nouă în history', () => {
  const visit = buildVisit();
  const updated = applyVisitStatus(visit, 'Efectuată', '2026-09-10T10:30:00.000Z');
  assert.equal(updated.status, 'Efectuată');
  assert.equal(updated.statusChangedAt, '2026-09-10T10:30:00.000Z');
  assert.equal(updated.history.length, visit.history.length + 1);
  assert.deepEqual(updated.history.at(-1), {
    at: '2026-09-10T10:30:00.000Z',
    status: 'Efectuată',
    date: visit.date,
    time: visit.time,
  });
  assert.equal(visit.status, 'Programată', 'vizita originală rămâne neschimbată');
});

test('applyVisitStatus refuză o tranziție care nu e în allowedNextStatuses', () => {
  const visit = buildVisit({ status: 'Renunțat' });
  assert.throws(() => applyVisitStatus(visit, 'Efectuată', '2026-09-10T10:30:00.000Z'));
  const inscris = buildVisit({ status: 'Înscris' });
  assert.throws(() => applyVisitStatus(inscris, 'Renunțat', '2026-09-10T10:30:00.000Z'));
});
