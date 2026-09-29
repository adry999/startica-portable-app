import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestApplication } from '#test-support/start-test-application.mjs';

const SETTINGS = {
  enabled: true,
  pricePerSession: 150,
  durationMin: 30,
  hoursFrom: '09:00',
  hoursTo: '11:30',
  seatsPerSlot: 2,
  chargeUnexcusedAbsence: true,
  coachPayMode: 'per_child',
  coachRate: 60,
};

/** @param {string} id */
const childRecord = id => ({ id, name: `Copil ${id}`, dueDay: 10, status: 'Activ' });

test('a treia programare pe un slot cu 2 locuri e refuzată', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-pool-' });

  const settingsResponse = await post('/api/pool/settings', SETTINGS);
  assert.equal(settingsResponse.status, 200, JSON.stringify(settingsResponse.body));

  let revision = (await get('/api/state')).revision;
  for (const id of ['C-1', 'C-2', 'C-3']) {
    const created = await post('/api/record', {
      type: 'children',
      mode: 'create',
      record: childRecord(id),
      revision,
      requestId: `seed-child-${id}`,
    });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    revision = created.body.revision;
  }
  const coachResponse = await post('/api/personal/staff', {
    mode: 'create',
    staff: {
      id: 'STF-1',
      name: 'Antrenor unu',
      roleId: 'ROL-antrenor-bazin',
      branchIds: [(await get('/api/session')).branch.id],
      since: '2026-01-01',
    },
  });
  assert.equal(coachResponse.status, 200, JSON.stringify(coachResponse.body));

  const slot = { coachId: 'STF-1', weekday: 2, time: '09:00', startDate: '2026-09-01', endDate: null };
  const first = await post('/api/pool/bookings', { booking: { ...slot, childId: 'C-1' } });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const second = await post('/api/pool/bookings', { booking: { ...slot, childId: 'C-2' } });
  assert.equal(second.status, 200, JSON.stringify(second.body));
  const third = await post('/api/pool/bookings', { booking: { ...slot, childId: 'C-3' } });
  assert.equal(third.status, 400);
  assert.match(third.body.error, /locuri/);
});

test('setările bazinului sunt per filială: Botanica nu vede prețul din Buiucani și Bazin lipsește din sesiunea ei', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-pool-branches-' });

  await post('/api/pool/settings', SETTINGS);
  const sessionA = await get('/api/session');
  assert.equal(sessionA.pool.enabled, true);

  const branchCreated = await post('/api/branches', { name: 'Botanica' });
  assert.equal(branchCreated.status, 200, JSON.stringify(branchCreated.body));
  await post('/api/branches/select', { id: branchCreated.body.branch.id });

  const settingsInBotanica = await get('/api/pool/settings');
  assert.equal(settingsInBotanica.settings, null);
  const sessionB = await get('/api/session');
  assert.equal(sessionB.pool.enabled, false);
});

test('GET /api/pool/month întoarce programările și ședințele fiecărui copil (pentru bonul de 58 mm)', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-pool-month-detail-' });
  await post('/api/pool/settings', SETTINGS);

  let revision = (await get('/api/state')).revision;
  const created = await post('/api/record', {
    type: 'children',
    mode: 'create',
    record: childRecord('C-1'),
    revision,
    requestId: 'seed-child-C-1',
  });
  revision = created.body.revision;
  await post('/api/personal/staff', {
    mode: 'create',
    staff: {
      id: 'STF-1',
      name: 'Antrenor unu',
      roleId: 'ROL-antrenor-bazin',
      branchIds: [(await get('/api/session')).branch.id],
      since: '2026-01-01',
    },
  });

  const booking = await post('/api/pool/bookings', {
    booking: { childId: 'C-1', coachId: 'STF-1', weekday: 2, time: '09:00', startDate: '2026-09-01', endDate: null },
  });
  assert.equal(booking.status, 200, JSON.stringify(booking.body));
  const bookingId = booking.body.booking.id;

  await post('/api/pool/sessions', { changes: [{ bookingId, date: '2026-09-01', status: 'present' }] });

  const month = await get('/api/pool/month?month=2026-09');
  assert.equal(month.children.length, 1);
  const row = month.children[0];
  assert.equal(row.bookings.length, 1);
  assert.equal(row.bookings[0].id, bookingId);
  assert.equal(row.sessions.length, 1);
  assert.deepEqual(
    { bookingId: row.sessions[0].bookingId, date: row.sessions[0].date, status: row.sessions[0].status },
    { bookingId, date: '2026-09-01', status: 'present' },
  );
});

/** @param {{ get: Function, post: Function }} client @param {string} childId */
async function seedChildAndCoach({ get, post }, childId) {
  let revision = (await get('/api/state')).revision;
  const created = await post('/api/record', {
    type: 'children',
    mode: 'create',
    record: childRecord(childId),
    revision,
    requestId: `seed-child-${childId}`,
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  await post('/api/personal/staff', {
    mode: 'create',
    staff: {
      id: 'STF-1',
      name: 'Antrenor unu',
      roleId: 'ROL-antrenor-bazin',
      branchIds: [(await get('/api/session')).branch.id],
      since: '2026-01-01',
    },
  });
}

test('A-1: Săptămâna nu arată ședințe într-o zi de sărbătoare legală, iar marcarea e refuzată', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-pool-holiday-' });
  await post('/api/pool/settings', SETTINGS);
  await seedChildAndCoach({ get, post }, 'C-1');

  // Vineri, 25 decembrie 2026 — Crăciunul, sărbătoare legală (FIXED_HOLIDAYS_MD).
  const booking = await post('/api/pool/bookings', {
    booking: { childId: 'C-1', coachId: 'STF-1', weekday: 5, time: '09:00', startDate: '2026-09-01', endDate: null },
  });
  assert.equal(booking.status, 200, JSON.stringify(booking.body));
  const bookingId = booking.body.booking.id;

  const week = await get('/api/pool/week?date=2026-12-25');
  const holiday = week.days.find(day => day.date === '2026-12-25');
  assert.ok(holiday, 'ziua de 25 decembrie trebuie să apară în săptămână');
  assert.equal(holiday.off, true);
  for (const slot of holiday.slots) assert.deepEqual(slot.entries, []);
  // Vinerea anterioară (18 decembrie, altă săptămână, zi lucrătoare) chiar arată ședința.
  const previousWeek = await get('/api/pool/week?date=2026-12-18');
  const workingFriday = previousWeek.days.find(day => day.date === '2026-12-18');
  assert.equal(workingFriday.off, false);
  const slotAt9 = workingFriday.slots.find(slot => slot.time === '09:00');
  assert.equal(slotAt9.entries.length, 1);

  const marked = await post('/api/pool/sessions', {
    changes: [{ bookingId, date: '2026-12-25', status: 'present' }],
  });
  assert.equal(marked.status, 400);
  assert.match(marked.body.error, /sărbătoare|zi/i);
});

test('A-3: o programare oprită cu dată de sfârșit viitoare rămâne activă până atunci, nu se arhivează imediat', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-pool-endbooking-' });
  await post('/api/pool/settings', SETTINGS);
  await seedChildAndCoach({ get, post }, 'C-1');

  const created = await post('/api/pool/bookings', {
    booking: { childId: 'C-1', coachId: 'STF-1', weekday: 2, time: '09:00', startDate: '2026-01-06', endDate: null },
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const bookingId = created.body.booking.id;

  // Data de sfârșit e în viitor (mult după "azi") — nu trebuie arhivată imediat.
  const ended = await post('/api/pool/bookings', { id: bookingId, endDate: '2026-12-31' });
  assert.equal(ended.status, 200, JSON.stringify(ended.body));
  assert.equal(ended.body.booking.archivedAt, null);

  // Săptămâna curentă (2026-09) rămâne activă — ședința tot apare, nu e ascunsă prematur.
  const week = await get('/api/pool/week?date=2026-09-08');
  const tuesday = week.days.find(day => day.date === '2026-09-08');
  const slot = tuesday.slots.find(candidate => candidate.time === '09:00');
  assert.equal(slot.entries.length, 1);
  assert.equal(slot.entries[0].booking.id, bookingId);

  // Se poate marca o ședință între azi și dată de sfârșit.
  const marked = await post('/api/pool/sessions', {
    changes: [{ bookingId, date: '2026-09-08', status: 'present' }],
  });
  assert.equal(marked.status, 200, JSON.stringify(marked.body));
});

test('A-3: o programare oprită cu dată de sfârșit trecută se arhivează, dar săptămânile dinaintea ei tot arată ședința', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-pool-endbooking-past-' });
  await post('/api/pool/settings', SETTINGS);
  await seedChildAndCoach({ get, post }, 'C-1');

  const created = await post('/api/pool/bookings', {
    booking: { childId: 'C-1', coachId: 'STF-1', weekday: 2, time: '09:00', startDate: '2026-01-01', endDate: null },
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const bookingId = created.body.booking.id;

  // Dată de sfârșit trecută (mult înaintea „azi”-ului real) — se arhivează.
  const ended = await post('/api/pool/bookings', { id: bookingId, endDate: '2026-01-15' });
  assert.equal(ended.status, 200, JSON.stringify(ended.body));
  assert.ok(ended.body.booking.archivedAt, 'trebuie arhivată — data de sfârșit a trecut deja');

  // O săptămână dinaintea datei de sfârșit (când programarea era încă activă) tot arată
  // ședința — `getWeek` nu se bazează doar pe `archivedAt`, ci și pe intervalul programării.
  const week = await get('/api/pool/week?date=2026-01-06');
  const tuesday = week.days.find(day => day.date === '2026-01-06');
  const slot = tuesday.slots.find(candidate => candidate.time === '09:00');
  assert.equal(slot.entries.length, 1);
  assert.equal(slot.entries[0].booking.id, bookingId);
});

test('A-6: Luna nu listează un copil fără nicio ședință programată în luna cerută', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-pool-month-filter-' });
  await post('/api/pool/settings', SETTINGS);

  let revision = (await get('/api/state')).revision;
  for (const id of ['C-1', 'C-2']) {
    const created = await post('/api/record', {
      type: 'children',
      mode: 'create',
      record: childRecord(id),
      revision,
      requestId: `seed-child-${id}`,
    });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    revision = created.body.revision;
  }
  await post('/api/personal/staff', {
    mode: 'create',
    staff: {
      id: 'STF-1',
      name: 'Antrenor unu',
      roleId: 'ROL-antrenor-bazin',
      branchIds: [(await get('/api/session')).branch.id],
      since: '2026-01-01',
    },
  });

  // C-1: programare activă în septembrie 2026 — trebuie să apară.
  const activeBooking = await post('/api/pool/bookings', {
    booking: { childId: 'C-1', coachId: 'STF-1', weekday: 2, time: '09:00', startDate: '2026-09-01', endDate: null },
  });
  assert.equal(activeBooking.status, 200, JSON.stringify(activeBooking.body));

  // C-2: programare care a existat și s-a terminat cu totul înainte de septembrie — zero
  // ședințe programate în luna cerută, nu doar „fără nicio prezență marcată”.
  const pastBooking = await post('/api/pool/bookings', {
    booking: {
      childId: 'C-2',
      coachId: 'STF-1',
      weekday: 2,
      time: '10:00',
      startDate: '2026-01-06',
      endDate: '2026-01-13',
    },
  });
  assert.equal(pastBooking.status, 200, JSON.stringify(pastBooking.body));

  const month = await get('/api/pool/month?month=2026-09');
  assert.deepEqual(
    month.children.map(row => row.childId),
    ['C-1'],
  );
});
