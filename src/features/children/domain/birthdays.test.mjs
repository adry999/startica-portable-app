import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBirthdayCalendar, listUpcomingBirthdays } from './birthdays.mjs';

const child = (id, birthDate, extra = {}) => ({ id, name: id, birthDate, ...extra });

const flatten = weeks => weeks.flat();
const cellFor = (weeks, dateStr) => flatten(weeks).find(c => c.date === dateStr);

test('buildBirthdayCalendar aliniază grila luni-duminică și umple din lunile vecine', () => {
  // Septembrie 2026 începe marți (2026-09-01), deci luni 31 august e umplutură.
  const weeks = buildBirthdayCalendar([], '2026-09-10');
  assert.equal(weeks.length, 5);
  assert.equal(weeks[0].length, 7);
  assert.equal(weeks[0][0].date, '2026-08-31');
  assert.equal(weeks[0][0].inMonth, false);
  assert.equal(weeks[0][1].date, '2026-09-01');
  assert.equal(weeks[0][1].inMonth, true);
  assert.equal(weeks.at(-1)?.at(-1)?.date, '2026-10-04');
});

test('buildBirthdayCalendar marchează ziua curentă și copiii cu ziua de naștere în lună', () => {
  const children = [
    child('c1', '2019-09-20'),
    child('c2', '2018-08-15'), // altă lună, nu apare
    child('c3', '2020-09-10', { archived: true }), // arhivat, nu apare
  ];
  const weeks = buildBirthdayCalendar(children, '2026-09-10');
  const today = cellFor(weeks, '2026-09-10');
  assert.equal(today.isToday, true);
  assert.equal(today.names.length, 0);

  const c1Cell = cellFor(weeks, '2026-09-20');
  assert.deepEqual(c1Cell.names, [{ name: 'c1', turningAge: 2026 - 2019 }]);
});

test('buildBirthdayCalendar marchează săptămâna curentă, chiar dacă traversează granița de lună', () => {
  // 2026-09-10 e joi; săptămâna e 2026-09-07 (luni) .. 2026-09-13 (duminică).
  const weeks = buildBirthdayCalendar([], '2026-09-10');
  const flat = flatten(weeks);
  const inWeek = flat.filter(c => c.isCurrentWeek).map(c => c.date);
  assert.deepEqual(inWeek, [
    '2026-09-07',
    '2026-09-08',
    '2026-09-09',
    '2026-09-10',
    '2026-09-11',
    '2026-09-12',
    '2026-09-13',
  ]);
});

test('buildBirthdayCalendar potrivește ziua de naștere după lună+zi, nu după an', () => {
  const weeks = buildBirthdayCalendar([child('old', '1990-09-05')], '2026-09-10');
  const cell = cellFor(weeks, '2026-09-05');
  assert.deepEqual(cell.names, [{ name: 'old', turningAge: 2026 - 1990 }]);
});

test('listUpcomingBirthdays ia doar zilele din fereastra dată, sortate crescător', () => {
  const children = [
    child('azi', '2020-09-10'),
    child('peste5', '2020-09-15'),
    child('peste2', '2020-09-12'),
    child('peste6', '2020-09-16'), // în afara ferestrei de 5 zile
    child('ieri', '2020-09-09'), // deja trecută
    child('arhivat', '2020-09-11', { archived: true }),
  ];
  const rows = listUpcomingBirthdays(children, 5, '2026-09-10');
  assert.deepEqual(
    rows.map(r => r.child.id),
    ['azi', 'peste2', 'peste5'],
  );
  assert.deepEqual(
    rows.map(r => r.daysUntil),
    [0, 2, 5],
  );
  assert.equal(rows[0].turningAge, 2026 - 2020);
});

test('listUpcomingBirthdays traversează corect granița de lună/an', () => {
  const rows = listUpcomingBirthdays([child('ian', '2015-01-02')], 5, '2025-12-30');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].daysUntil, 3);
  assert.equal(rows[0].turningAge, 2026 - 2015);
});
