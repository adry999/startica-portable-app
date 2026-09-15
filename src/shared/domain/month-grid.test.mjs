import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthGrid } from './month-grid.mjs';

const flatten = weeks => weeks.flat();
const cellFor = (weeks, dateStr) => flatten(weeks).find(c => c.date === dateStr);

test('buildMonthGrid nu adaugă umplutură când luna începe luni', () => {
  // Iunie 2026 începe luni (2026-06-01).
  const weeks = buildMonthGrid('2026-06', '2026-06-10');
  assert.equal(weeks.length, 5);
  assert.equal(weeks[0][0].date, '2026-06-01');
  assert.equal(weeks[0][0].inMonth, true);
  assert.equal(weeks.at(-1)?.at(-1)?.date, '2026-07-05');
});

test('buildMonthGrid umple din lunile vecine când luna începe duminică', () => {
  // Noiembrie 2026 începe duminică (2026-11-01), deci luni 26 octombrie e umplutură.
  const weeks = buildMonthGrid('2026-11', '2026-11-10');
  assert.equal(weeks.length, 6);
  assert.equal(weeks[0][0].date, '2026-10-26');
  assert.equal(weeks[0][0].inMonth, false);
  assert.equal(weeks[0][6].date, '2026-11-01');
  assert.equal(weeks[0][6].inMonth, true);
});

test('buildMonthGrid acoperă corect februarie bisect', () => {
  const weeks = buildMonthGrid('2024-02', '2024-02-15');
  assert.equal(weeks.length, 5);
  const last = cellFor(weeks, '2024-02-29');
  assert.equal(last.inMonth, true);
});

test('buildMonthGrid marchează ziua curentă doar când e în lună', () => {
  const weeks = buildMonthGrid('2026-09', '2026-09-10');
  const today = cellFor(weeks, '2026-09-10');
  assert.equal(today.isToday, true);
  assert.equal(cellFor(weeks, '2026-09-11').isToday, false);
});

test('buildMonthGrid nu marchează nimic ca azi când luna afișată nu e luna curentă', () => {
  const weeks = buildMonthGrid('2026-06', '2026-09-10');
  assert.equal(
    flatten(weeks).some(c => c.isToday),
    false,
  );
  assert.equal(
    flatten(weeks).some(c => c.isCurrentWeek),
    false,
  );
});

test('buildMonthGrid marchează săptămâna curentă, chiar dacă traversează granița de lună', () => {
  // 2026-09-02 e miercuri; săptămâna e 2026-08-31 (luni) .. 2026-09-06 (duminică).
  // Luna afișată e august, deci ultima săptămână a grilei conține zile din septembrie.
  const weeks = buildMonthGrid('2026-08', '2026-09-02');
  const inWeek = flatten(weeks)
    .filter(c => c.isCurrentWeek)
    .map(c => c.date);
  assert.deepEqual(inWeek, [
    '2026-08-31',
    '2026-09-01',
    '2026-09-02',
    '2026-09-03',
    '2026-09-04',
    '2026-09-05',
    '2026-09-06',
  ]);
  assert.equal(cellFor(weeks, '2026-08-31').inMonth, true);
  assert.equal(cellFor(weeks, '2026-09-01').inMonth, false);
});
