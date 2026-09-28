import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startTestApplication } from '#test-support/start-test-application.mjs';

async function startApplication(t) {
  return startTestApplication(t, { prefix: 'startica-attendance-' });
}

const importRequest = (state, revision) => ({ state, confirm: 'IMPORT', revision, requestId: randomUUID() });
const emptyImport = overrides => ({
  children: [],
  payments: [],
  expenses: [],
  groups: [],
  categories: [],
  visits: [],
  ...overrides,
});

const child = (overrides = {}) => ({
  id: 'CH-1',
  name: 'Popescu Ana',
  parent: 'Popescu Ion',
  phone: '0722000000',
  groupId: 'GR-1',
  status: 'Activ',
  ...overrides,
});

async function seedChildren(post) {
  const imported = await post(
    '/api/import',
    importRequest(
      emptyImport({
        groups: [{ id: 'GR-1', name: 'Fluturași' }],
        children: [
          child({ id: 'CH-1', groupId: 'GR-1' }),
          child({ id: 'CH-2', name: 'Ionescu Maria', groupId: null }),
          child({ id: 'CH-3', name: 'Vasile Dan', groupId: 'GR-1', archived: true }),
          child({ id: 'CH-4', name: 'Rusu Ioana', groupId: 'GR-1', attendanceDate: '2099-01-01' }),
        ],
      }),
      0,
    ),
  );
  assert.equal(imported.status, 200, imported.body.error);
  return imported;
}

test('POST creează marcajele zilei, GET pe zi le întoarce, un al doilea POST pe aceeași zi câștigă', async t => {
  const { get, post } = await startApplication(t);
  await seedChildren(post);

  const first = await post('/api/attendance', {
    changes: [{ childId: 'CH-1', date: '2026-09-20', status: 'present' }],
  });
  assert.equal(first.status, 200, first.body.error);
  assert.equal(first.body.saved[0].status, 'present');

  const second = await post('/api/attendance', {
    changes: [{ childId: 'CH-1', date: '2026-09-20', status: 'absent' }],
  });
  assert.equal(second.status, 200);

  const entries = await get('/api/attendance?date=2026-09-20');
  assert.equal(entries.entries.length, 1);
  assert.equal(entries.entries[0].status, 'absent');
});

test('status null șterge marcajul', async t => {
  const { get, post } = await startApplication(t);
  await seedChildren(post);
  await post('/api/attendance', { changes: [{ childId: 'CH-1', date: '2026-09-20', status: 'present' }] });

  const result = await post('/api/attendance', { changes: [{ childId: 'CH-1', date: '2026-09-20', status: null }] });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.removed, [{ childId: 'CH-1', date: '2026-09-20' }]);

  const entries = await get('/api/attendance?date=2026-09-20');
  assert.equal(entries.entries.length, 0);
});

test('motivul se păstrează doar pentru motivat', async t => {
  const { get, post } = await startApplication(t);
  await seedChildren(post);
  await post('/api/attendance', {
    changes: [
      { childId: 'CH-1', date: '2026-09-20', status: 'excused', reason: 'Boală' },
      { childId: 'CH-2', date: '2026-09-20', status: 'present', reason: 'ignorat' },
    ],
  });

  const entries = await get('/api/attendance?date=2026-09-20');
  const excused = entries.entries.find(entry => entry.childId === 'CH-1');
  const present = entries.entries.find(entry => entry.childId === 'CH-2');
  assert.equal(excused.reason, 'Boală');
  assert.equal(present.reason, '');
});

test('o zi viitoare, un copil inexistent sau o stare necunoscută dau 400 și nu salvează nimic din lot', async t => {
  const { get, post } = await startApplication(t);
  await seedChildren(post);

  const futureDay = await post('/api/attendance', {
    changes: [
      { childId: 'CH-1', date: '2026-09-20', status: 'present' },
      { childId: 'CH-2', date: '2099-01-01', status: 'present' },
    ],
  });
  assert.equal(futureDay.status, 400);

  const unknownChild = await post('/api/attendance', {
    changes: [{ childId: 'CH-LIPSA', date: '2026-09-20', status: 'present' }],
  });
  assert.equal(unknownChild.status, 400);

  const unknownStatus = await post('/api/attendance', {
    changes: [{ childId: 'CH-1', date: '2026-09-20', status: 'plecat' }],
  });
  assert.equal(unknownStatus.status, 400);

  const entries = await get('/api/attendance?date=2026-09-20');
  assert.equal(entries.entries.length, 0, 'niciuna dintre cereri nu a salvat vreo schimbare din lot');
});

test('un copil arhivat sau înscris după ziua marcată e refuzat (m15)', async t => {
  const { get, post } = await startApplication(t);
  await seedChildren(post);

  const archivedChild = await post('/api/attendance', {
    changes: [{ childId: 'CH-3', date: '2026-09-20', status: 'present' }],
  });
  assert.equal(archivedChild.status, 400);

  const notYetEnrolled = await post('/api/attendance', {
    changes: [{ childId: 'CH-4', date: '2026-09-20', status: 'present' }],
  });
  assert.equal(notYetEnrolled.status, 400);

  const entries = await get('/api/attendance?date=2026-09-20');
  assert.equal(entries.entries.length, 0, 'niciuna dintre cereri nu a salvat vreo schimbare');
});

test('GET pe lună cu groupId întoarce doar copiii grupei, cu childId doar copilul, cu groupId=none copiii fără grupă', async t => {
  const { get, post } = await startApplication(t);
  await seedChildren(post);
  await post('/api/attendance', {
    changes: [
      { childId: 'CH-1', date: '2026-09-01', status: 'present' },
      { childId: 'CH-2', date: '2026-09-01', status: 'present' },
    ],
  });

  const byGroup = await get('/api/attendance?month=2026-09&groupId=GR-1');
  assert.deepEqual(
    byGroup.entries.map(entry => entry.childId),
    ['CH-1'],
  );

  const byChild = await get('/api/attendance?month=2026-09&childId=CH-2');
  assert.deepEqual(
    byChild.entries.map(entry => entry.childId),
    ['CH-2'],
  );

  const withoutGroup = await get('/api/attendance?month=2026-09&groupId=none');
  assert.deepEqual(
    withoutGroup.entries.map(entry => entry.childId),
    ['CH-2'],
  );
});

test('GET fără date și fără month dă 400', async t => {
  const { origin, post } = await startApplication(t);
  await seedChildren(post);
  const response = await fetch(`${origin}/api/attendance`);
  assert.equal(response.status, 400);
});
