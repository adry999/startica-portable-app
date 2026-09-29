import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expandBooking,
  weekOf,
  weekdayOf,
  sessionStateFor,
  sessionsByKeyOf,
  seatsTaken,
  seatsTakenOverlapping,
} from './pool-schedule.mjs';

test('o programare de marți produce datele lunii fără sărbătorile legale și în intervalul ei', () => {
  // Septembrie 2026: 1 sept (marți) e zi lucrătoare, fără sărbători legale în lună.
  const booking = {
    id: 'PB-1',
    childId: 'C-1',
    coachId: 'STF-1',
    weekday: 2,
    time: '09:00',
    startDate: '2026-09-08',
    endDate: null,
    archivedAt: null,
    updatedAt: '',
  };
  const dates = expandBooking(booking, '2026-09');
  // Marțile din septembrie 2026 de la 08 încolo: 08, 15, 22, 29.
  assert.deepEqual(dates, ['2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29']);
});

test('expandBooking respectă startDate și endDate', () => {
  const booking = {
    id: 'PB-2',
    childId: 'C-1',
    coachId: 'STF-1',
    weekday: 1,
    time: '09:00',
    startDate: '2026-09-10',
    endDate: '2026-09-20',
    archivedAt: null,
    updatedAt: '',
  };
  // Lunile din septembrie 2026: 07, 14, 21, 28 — doar 14 e în interval.
  assert.deepEqual(expandBooking(booking, '2026-09'), ['2026-09-14']);
});

test('expandBooking sare zilele legale nelucrătoare', () => {
  const booking = {
    id: 'PB-3',
    childId: 'C-1',
    coachId: 'STF-1',
    weekday: 5, // vineri
    time: '09:00',
    startDate: '2026-08-01',
    endDate: null,
    archivedAt: null,
    updatedAt: '',
  };
  // Vinerea din august 2026: 7,14,21,28 — nicio sărbătoare legală nu cade vineri în 2026.
  assert.deepEqual(expandBooking(booking, '2026-08'), ['2026-08-07', '2026-08-14', '2026-08-21', '2026-08-28']);
});

test('expandBooking sare o vineri care e chiar zi de sărbătoare legală', () => {
  const booking = {
    id: 'PB-3b',
    childId: 'C-1',
    coachId: 'STF-1',
    weekday: 2, // marți
    time: '09:00',
    startDate: '2026-05-01',
    endDate: null,
    archivedAt: null,
    updatedAt: '',
  };
  // 5 mai 2026 e marți — nu e sărbătoare; dar Ziua Victoriei (9 mai) e sâmbătă în 2026, deci
  // testul de excludere reală se face pe 1 iunie (Ziua Ocrotirii Copilului), care în 2026 e luni.
  const juneBooking = { ...booking, weekday: 1, startDate: '2026-06-01' };
  const dates = expandBooking(juneBooking, '2026-06');
  assert.ok(!dates.includes('2026-06-01'), '1 iunie (Ziua Ocrotirii Copilului) nu produce ședință.');
});

test('weekOf întoarce luni…vineri săptămânii care conține data', () => {
  assert.equal(weekdayOf('2026-09-09'), 3); // miercuri
  assert.deepEqual(weekOf('2026-09-09'), ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']);
});

test('sessionStateFor: rând existent, nemarcat trecut, programat viitor', () => {
  const sessions = sessionsByKeyOf([{ bookingId: 'PB-1', date: '2026-09-08', status: 'present', updatedAt: '' }]);
  assert.equal(sessionStateFor('PB-1', '2026-09-08', sessions, '2026-09-30'), 'present');
  assert.equal(sessionStateFor('PB-1', '2026-09-15', sessions, '2026-09-30'), 'unmarked');
  assert.equal(sessionStateFor('PB-1', '2026-10-05', sessions, '2026-09-30'), 'scheduled');
});

test('seatsTaken numără doar programările active pe slotul și data cerută', () => {
  /** @type {import('../pool.types.d.mts').PoolBooking[]} */
  const bookings = [
    {
      id: 'PB-1',
      childId: 'C-1',
      coachId: 'STF-1',
      weekday: 2,
      time: '09:00',
      startDate: '2026-09-01',
      endDate: null,
      archivedAt: null,
      updatedAt: '',
    },
    {
      id: 'PB-2',
      childId: 'C-2',
      coachId: 'STF-1',
      weekday: 2,
      time: '09:00',
      startDate: '2026-09-01',
      endDate: '2026-09-10',
      archivedAt: null,
      updatedAt: '',
    },
    {
      id: 'PB-3',
      childId: 'C-3',
      coachId: 'STF-1',
      weekday: 2,
      time: '10:00',
      startDate: '2026-09-01',
      endDate: null,
      archivedAt: null,
      updatedAt: '',
    },
    {
      id: 'PB-4',
      childId: 'C-4',
      coachId: 'STF-1',
      weekday: 2,
      time: '09:00',
      startDate: '2026-09-01',
      endDate: null,
      archivedAt: '2026-09-05T00:00:00Z',
      updatedAt: '',
    },
  ];
  assert.equal(seatsTaken(bookings, 2, '09:00', '2026-09-15'), 1); // PB-2 s-a terminat (endDate 09-10), PB-4 e arhivată
  assert.equal(seatsTaken(bookings, 2, '09:00', '2026-09-05'), 2); // PB-1 și PB-2 încă active
  assert.equal(seatsTaken(bookings, 2, '09:00', '2026-09-05', 'PB-1'), 1); // exclude programarea proprie (editare)
});

test('seatsTakenOverlapping numără programările care s-ar suprapune vreodată, nu doar la data de start (A-5)', () => {
  /** @type {import('../pool.types.d.mts').PoolBooking[]} */
  const bookingStartingInOctober = [
    {
      id: 'PB-A',
      childId: 'C-A',
      coachId: 'STF-1',
      weekday: 2,
      time: '09:00',
      startDate: '2026-10-05',
      endDate: null,
      archivedAt: null,
      updatedAt: '',
    },
  ];
  // B pornește înainte de A (28 septembrie); la data ei de start, A încă nu exista — dar din
  // octombrie încolo ambele ar avea loc în același slot, cu o capacitate de 1 loc.
  assert.equal(
    seatsTakenOverlapping(bookingStartingInOctober, 2, '09:00', { startDate: '2026-09-28', endDate: null }),
    1,
  );
  // O programare terminată înainte ca cealaltă să înceapă nu se suprapune.
  const endedBeforeOctober = [{ ...bookingStartingInOctober[0], id: 'PB-B', endDate: '2026-09-30' }];
  assert.equal(seatsTakenOverlapping(endedBeforeOctober, 2, '09:00', { startDate: '2026-10-05', endDate: null }), 0);
  // Excludere pe id propriu (editarea unei programări existente) și pe slot diferit.
  assert.equal(
    seatsTakenOverlapping(bookingStartingInOctober, 2, '09:00', { startDate: '2026-09-28', endDate: null }, 'PB-A'),
    0,
  );
  assert.equal(
    seatsTakenOverlapping(bookingStartingInOctober, 3, '09:00', { startDate: '2026-09-28', endDate: null }),
    0,
  );
});
