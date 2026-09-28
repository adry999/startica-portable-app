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
