import test from 'node:test';
import assert from 'node:assert/strict';
import { orthodoxEaster, legalHolidaysMd, isLegalHolidayMd, isWeekend, isWorkingDay } from './holidays-md.mjs';

test('Paștele ortodox cade pe 20.04.2025, 12.04.2026, 02.05.2027', () => {
  assert.equal(orthodoxEaster(2025), '2025-04-20');
  assert.equal(orthodoxEaster(2026), '2026-04-12');
  assert.equal(orthodoxEaster(2027), '2027-05-02');
});

test('sărbătorile legale ale anului 2026 sunt 13 zile, inclusiv Paștele Blajinilor pe 20 aprilie', () => {
  const holidays = legalHolidaysMd(2026);
  assert.equal(holidays.length, 13);
  assert.equal(isLegalHolidayMd('2026-12-26'), false);
  assert.ok(holidays.some(holiday => holiday.date === '2026-04-20' && holiday.name.includes('Blajinilor')));
});

test('weekend-ul și sărbătorile nu sunt zile lucrătoare, o marți obișnuită este', () => {
  assert.equal(isLegalHolidayMd('2026-01-01'), true);
  assert.equal(isWeekend('2026-09-27'), true);
  assert.equal(isWorkingDay('2026-01-01'), false);
  assert.equal(isWorkingDay('2026-09-27'), false);
  assert.equal(isWorkingDay('2026-09-29'), true);
});
