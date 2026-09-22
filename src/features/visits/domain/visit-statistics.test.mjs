import test from 'node:test';
import assert from 'node:assert/strict';
import { countVisitsForDays, summarizeVisitFunnel } from './visit-statistics.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Visit} Visit */

/** @returns {Visit} */
function buildVisit(overrides = {}) {
  return {
    id: 'VIZ-1',
    name: 'Ana Popescu',
    parent: 'Maria Popescu',
    phone: '0722000000',
    status: 'Programată',
    date: '2026-09-10',
    time: '10:00',
    statusChangedAt: '2026-09-01T10:00:00.000Z',
    history: [],
    desiredGroupId: null,
    childId: '',
    archived: false,
    ...overrides,
  };
}

test('summarizeVisitFunnel numără vizitele programate viitoare și tranzițiile din ultimele 12 luni', () => {
  const visits = [
    buildVisit({ id: 'VIZ-1', status: 'Programată', date: '2026-09-20' }),
    buildVisit({ id: 'VIZ-2', status: 'Programată', date: '2026-09-01' }),
    buildVisit({ id: 'VIZ-3', status: 'Efectuată', statusChangedAt: '2026-06-01T10:00:00.000Z' }),
    buildVisit({ id: 'VIZ-4', status: 'Efectuată', statusChangedAt: '2020-01-01T10:00:00.000Z' }),
    buildVisit({ id: 'VIZ-5', status: 'Înscris', statusChangedAt: '2026-08-01T10:00:00.000Z' }),
    buildVisit({ id: 'VIZ-6', status: 'Renunțat', statusChangedAt: '2026-08-15T10:00:00.000Z' }),
    buildVisit({ id: 'VIZ-7', status: 'Efectuată', statusChangedAt: '2026-06-01T10:00:00.000Z', archived: true }),
  ];

  const funnel = summarizeVisitFunnel(visits, '2026-09-10');

  assert.deepEqual(funnel, { scheduled: 1, done: 1, enrolled: 1, withdrew: 1 });
});

test('summarizeVisitFunnel exclude vizitele arhivate din toate contoarele', () => {
  const visits = [
    buildVisit({ status: 'Programată', date: '2026-09-20', archived: true }),
    buildVisit({ status: 'Efectuată', archived: true }),
  ];

  assert.deepEqual(summarizeVisitFunnel(visits, '2026-09-10'), { scheduled: 0, done: 0, enrolled: 0, withdrew: 0 });
});

test('countVisitsForDays alege vizitele programate de azi și de mâine, sortate după oră', () => {
  const visits = [
    buildVisit({ id: 'VIZ-1', date: '2026-09-10', time: '11:00' }),
    buildVisit({ id: 'VIZ-2', date: '2026-09-10', time: '09:00' }),
    buildVisit({ id: 'VIZ-3', date: '2026-09-11', time: '08:00' }),
    buildVisit({ id: 'VIZ-4', date: '2026-09-12', time: '08:00' }),
    buildVisit({ id: 'VIZ-5', date: '2026-09-10', time: '10:00', status: 'Efectuată' }),
    buildVisit({ id: 'VIZ-6', date: '2026-09-10', time: '12:00', archived: true }),
  ];

  const result = countVisitsForDays(visits, '2026-09-10');

  assert.equal(result.today, 2);
  assert.equal(result.tomorrow, 1);
  // Sortare doar după oră (§3.5): VIZ-3 e mâine dar la 08:00, deci vine primul.
  assert.deepEqual(
    result.items.map(item => item.id),
    ['VIZ-3', 'VIZ-2', 'VIZ-1'],
  );
});

test('countVisitsForDays trece corect peste granița de an', () => {
  const visits = [
    buildVisit({ id: 'VIZ-1', date: '2026-12-31', time: '09:00' }),
    buildVisit({ id: 'VIZ-2', date: '2027-01-01', time: '09:00' }),
  ];

  const result = countVisitsForDays(visits, '2026-12-31');

  assert.equal(result.today, 1);
  assert.equal(result.tomorrow, 1);
});

test('countVisitsForDays cu orizont 0 ia doar azi', () => {
  const visits = [
    buildVisit({ id: 'VIZ-1', date: '2026-09-10', time: '09:00' }),
    buildVisit({ id: 'VIZ-2', date: '2026-09-11', time: '09:00' }),
  ];

  const result = countVisitsForDays(visits, '2026-09-10', 0);

  assert.deepEqual(
    result.items.map(item => item.id),
    ['VIZ-1'],
  );
  assert.equal(result.tomorrow, 0);
});

test('countVisitsForDays cu orizont mai mare de 1 include zilele următoare', () => {
  const visits = [
    buildVisit({ id: 'VIZ-1', date: '2026-09-10', time: '09:00' }),
    buildVisit({ id: 'VIZ-2', date: '2026-09-12', time: '09:00' }),
    buildVisit({ id: 'VIZ-3', date: '2026-09-13', time: '09:00' }),
  ];

  const result = countVisitsForDays(visits, '2026-09-10', 3);

  assert.deepEqual(result.items.map(item => item.id).sort(), ['VIZ-1', 'VIZ-2', 'VIZ-3']);
});
