import test from 'node:test';
import assert from 'node:assert/strict';
import { childMonth, coachPayForMonth, monthTotals, countUnmarkedPastSessions } from './pool-month.mjs';

/** @type {import('../pool.types.d.mts').PoolSettings} */
const settings = {
  enabled: true,
  pricePerSession: 150,
  durationMin: 30,
  hoursFrom: '09:00',
  hoursTo: '11:30',
  seatsPerSlot: 6,
  chargeUnexcusedAbsence: true,
  coachPayMode: 'per_child',
  coachRate: 60,
};

// Marțile din septembrie 2026: 01, 08, 15, 22, 29 (5 ședințe).
/** @type {import('../pool.types.d.mts').PoolBooking} */
const booking = {
  id: 'PB-1',
  childId: 'C-1',
  coachId: 'STF-1',
  weekday: 2,
  time: '09:00',
  startDate: '2026-09-01',
  endDate: null,
  archivedAt: null,
  updatedAt: '',
};

test('suma copilului = prezențe × preț, plus lipsele nemotivate doar când setarea o cere; motivat și anulat = 0', () => {
  /** @type {import('../pool.types.d.mts').PoolSession[]} */
  const sessions = [
    { bookingId: 'PB-1', date: '2026-09-01', status: 'present', updatedAt: '' },
    { bookingId: 'PB-1', date: '2026-09-08', status: 'present', updatedAt: '' },
    { bookingId: 'PB-1', date: '2026-09-15', status: 'absent', updatedAt: '' }, // nemotivată
    { bookingId: 'PB-1', date: '2026-09-22', status: 'excused', updatedAt: '' },
    { bookingId: 'PB-1', date: '2026-09-29', status: 'cancelled', updatedAt: '' },
  ];
  const row = childMonth({ bookings: [booking], sessions, month: '2026-09', settings, todayStr: '2026-09-30' });
  assert.equal(row.scheduled, 5);
  assert.equal(row.present, 2);
  assert.equal(row.absent, 1);
  assert.equal(row.excused, 1);
  assert.equal(row.cancelled, 1);
  // (2 prezențe + 1 lipsă nemotivată taxată) × 150 = 450.
  assert.equal(row.amount, 450);

  const noCharge = childMonth({
    bookings: [booking],
    sessions,
    month: '2026-09',
    settings: { ...settings, chargeUnexcusedAbsence: false },
    todayStr: '2026-09-30',
  });
  // Fără taxarea absenței: doar cele 2 prezențe × 150 = 300.
  assert.equal(noCharge.amount, 300);
});

test('salariul antrenorului din închidere e egal cu cel de pe card (aceeași funcție)', () => {
  const secondChild = { ...booking, id: 'PB-2', childId: 'C-2' };
  /** @type {import('../pool.types.d.mts').PoolSession[]} */
  const sessions = [
    { bookingId: 'PB-1', date: '2026-09-01', status: 'present', updatedAt: '' },
    { bookingId: 'PB-2', date: '2026-09-01', status: 'present', updatedAt: '' },
    { bookingId: 'PB-1', date: '2026-09-08', status: 'present', updatedAt: '' },
    { bookingId: 'PB-2', date: '2026-09-08', status: 'absent', updatedAt: '' },
  ];
  const bookings = [booking, secondChild];
  const perChild = coachPayForMonth({
    coachId: 'STF-1',
    bookings,
    sessions,
    month: '2026-09',
    settings,
    todayStr: '2026-09-30',
  });
  // 01: ambii copii prezenți (2 copii-prezențe); 08: doar C-1 prezent (1) → 3 copii-prezențe.
  assert.equal(perChild.sessionsHeld, 2); // 2 ședințe distincte (date,time) cu ≥1 prezență
  assert.equal(perChild.childrenPresent, 3);
  assert.equal(perChild.amount, 180); // 60 × 3

  const perSession = coachPayForMonth({
    coachId: 'STF-1',
    bookings,
    sessions,
    month: '2026-09',
    settings: { ...settings, coachPayMode: 'per_session' },
    todayStr: '2026-09-30',
  });
  assert.equal(perSession.amount, 120); // 60 × 2 ședințe

  // Cardul (aceeași apelare, alte date) trebuie să dea exact aceeași valoare — nicio a doua formulă.
  const cardValue = coachPayForMonth({
    coachId: 'STF-1',
    bookings,
    sessions,
    month: '2026-09',
    settings,
    todayStr: '2026-09-30',
  });
  assert.equal(cardValue.amount, perChild.amount);
});

test('monthTotals adună rândurile copiilor', () => {
  const totals = monthTotals([
    { scheduled: 4, present: 3, absent: 1, excused: 0, cancelled: 0, unmarked: 0, amount: 450 },
    { scheduled: 4, present: 2, absent: 0, excused: 2, cancelled: 0, unmarked: 0, amount: 300 },
  ]);
  assert.deepEqual(totals, { scheduled: 8, present: 5, absent: 1, revenue: 750 });
});

test('countUnmarkedPastSessions numără doar ședințele trecute fără rând', () => {
  /** @type {import('../pool.types.d.mts').PoolSession[]} */
  const sessions = [{ bookingId: 'PB-1', date: '2026-09-01', status: 'present', updatedAt: '' }];
  // Ședințe trecute (până la 09-08 inclusiv, asOf): 09-01 (marcată), 09-08 (nemarcată).
  const count = countUnmarkedPastSessions({ bookings: [booking], sessions, month: '2026-09', todayStr: '2026-09-08' });
  assert.equal(count, 1);
});
