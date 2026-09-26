import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBirthdayCalendar, buildBirthdayMonth, listUpcomingBirthdays } from './birthdays.mjs';

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

test('buildBirthdayCalendar arată copilul născut pe 02-29 pe 02-28 în ani non-bisecți', () => {
  const children = [child('febborn', '2020-02-29')];
  const weeks = buildBirthdayCalendar(children, '2025-02-28');
  assert.deepEqual(cellFor(weeks, '2025-02-28').names, [{ name: 'febborn', turningAge: 2025 - 2020 }]);

  const weeksLeap = buildBirthdayCalendar(children, '2024-02-29');
  assert.deepEqual(cellFor(weeksLeap, '2024-02-28').names, []);
  assert.deepEqual(cellFor(weeksLeap, '2024-02-29').names, [{ name: 'febborn', turningAge: 2024 - 2020 }]);
});

test('listUpcomingBirthdays arată copilul născut pe 02-29 pe 02-28 în ani non-bisecți', () => {
  const children = [child('febborn', '2020-02-29')];
  const rows = listUpcomingBirthdays(children, 5, '2025-02-25');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].child.id, 'febborn');
  assert.equal(rows[0].daysUntil, 3);
  assert.equal(listUpcomingBirthdays(children, 5, '2024-02-25')[0].daysUntil, 4);
});

test('buildBirthdayMonth calculează vârsta din anul celulei și numele compact din "Nume Prenume"', () => {
  const children = [{ id: 'c1', name: 'Cujba Ovidiu', birthDate: '2023-09-11', groupId: 'g1', archived: false }];
  const { weeks, list } = buildBirthdayMonth(children, '2026-09', '2026-09-05');
  const cell = cellFor(weeks, '2026-09-11');
  assert.deepEqual(cell.entries, [
    { childId: 'c1', name: 'Cujba Ovidiu', firstName: 'Ovidiu', lastInitial: 'C.', turningAge: 3, groupId: 'g1' },
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].day, 11);
  assert.equal(list[0].date, '2026-09-11');
});

test('buildBirthdayMonth arată 29 februarie pe 28 în ani nebisecți, pe 29 în ani bisecți', () => {
  const children = [child('febborn', '2020-02-29')];
  assert.deepEqual(
    cellFor(buildBirthdayMonth(children, '2027-02', '2027-02-01').weeks, '2027-02-28').entries.map(e => e.childId),
    ['febborn'],
  );
  assert.deepEqual(
    cellFor(buildBirthdayMonth(children, '2028-02', '2028-02-01').weeks, '2028-02-29').entries.map(e => e.childId),
    ['febborn'],
  );
});

test('buildBirthdayMonth omite copiii arhivați sau fără dată de naștere', () => {
  const children = [
    child('arhivat', '2026-09-11', { archived: true }),
    { id: 'fara-data', name: 'Fără Dată', archived: false },
  ];
  const { list } = buildBirthdayMonth(children, '2026-09', '2026-09-05');
  assert.deepEqual(list, []);
});

test('buildBirthdayMonth nu pune intrări pe celulele din lunile vecine', () => {
  // Septembrie 2026 începe marți — 31 august e umplutură dintr-o altă lună.
  const children = [child('lunaTrecuta', '2020-08-31')];
  const { weeks } = buildBirthdayMonth(children, '2026-09', '2026-09-05');
  const paddingCell = cellFor(weeks, '2026-08-31');
  assert.equal(paddingCell.inMonth, false);
  assert.deepEqual(paddingCell.entries, []);
});

test('buildBirthdayMonth sortează lista după zi, apoi după nume', () => {
  const children = [
    { id: 'b', name: 'Z Ultimul', birthDate: '2020-09-20', groupId: null, archived: false },
    { id: 'a', name: 'A Primul', birthDate: '2020-09-20', groupId: null, archived: false },
    { id: 'c', name: 'Devreme', birthDate: '2020-09-05', groupId: null, archived: false },
  ];
  const { list } = buildBirthdayMonth(children, '2026-09', '2026-09-01');
  assert.deepEqual(
    list.map(e => e.childId),
    ['c', 'a', 'b'],
  );
});
