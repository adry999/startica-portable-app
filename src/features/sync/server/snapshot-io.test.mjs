import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { createSyncStateRepository } from './sync-state.repository.mjs';
import { createSettingsRepository } from '#core/server/settings/settings-repository.mjs';
import { readLocalSnapshot, writeLocalSnapshot } from './snapshot-io.mjs';

function harness() {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  return database;
}

test('readLocalSnapshot citește toate tipurile de înregistrări ca entries plate, cu updatedAt', () => {
  const database = harness();
  const raw = createRecordRepository(database);
  raw.save('children', { id: 'CHILD-1', name: 'Ana' });
  raw.save('groups', { id: 'GRP-1', name: 'Fluturași' });

  const snapshot = readLocalSnapshot(database, { now: () => new Date('2026-09-28T10:00:00.000Z') });

  assert.equal(snapshot.entries.length, 2);
  const child = snapshot.entries.find(entry => entry.kind === 'children');
  assert.deepEqual(child, {
    kind: 'children',
    id: 'CHILD-1',
    payload: { id: 'CHILD-1', name: 'Ana' },
    updatedAt: '2026-09-28T10:00:00.000Z',
  });
});

test('readLocalSnapshot pe o bază goală întoarce o listă goală', () => {
  const database = harness();
  const snapshot = readLocalSnapshot(database, { now: () => new Date() });
  assert.deepEqual(snapshot.entries, []);
});

test('writeLocalSnapshot scrie fiecare fișă (normalizată, ca la 410) și sync_state-ul ei, plus cursorul sync.since', () => {
  const database = harness();
  const raw = createRecordRepository(database);
  const syncState = createSyncStateRepository(database);
  const settings = createSettingsRepository(database);

  writeLocalSnapshot(database, {
    records: {
      children: [
        { id: 'CHILD-1', revision: 1, payload: { id: 'CHILD-1', name: 'Ana' }, updatedAt: '2026-09-01T00:00:00.000Z' },
      ],
      groups: [
        {
          id: 'GRP-1',
          revision: 3,
          payload: { id: 'GRP-1', name: 'Fluturași' },
          updatedAt: '2026-09-02T00:00:00.000Z',
        },
      ],
    },
    headSeq: 42,
  });

  // applySnapshotEntry normalizează fișele (ca la 410) — verificăm câmpurile trimise, nu
  // egalitate strictă cu payload-ul brut (normalizeRecord adaugă implicite: status, dueDay...).
  assert.equal(raw.find('children', 'CHILD-1')?.name, 'Ana');
  assert.equal(raw.find('groups', 'GRP-1')?.name, 'Fluturași');
  assert.deepEqual(syncState.get('groups', 'GRP-1'), {
    kind: 'groups',
    id: 'GRP-1',
    serverRevision: 3,
    updatedAt: '2026-09-02T00:00:00.000Z',
    updatedByDevice: '',
    updatedByName: '',
  });
  assert.equal(settings.setting('sync.since'), '42');
});

test('writeLocalSnapshot pe un instantaneu gol nu scrie nimic și lasă cursorul la headSeq', () => {
  const database = harness();
  const settings = createSettingsRepository(database);

  writeLocalSnapshot(database, { records: {}, headSeq: 0 });

  assert.equal(settings.setting('sync.since'), '0');
});

// B-1 (audit 2026-09-29): un snapshot cu attendance/pool_sessions arunca — raw.save() cerea
// forma records(kind,id,payload), pe care prezența/bazinul n-o au (fără `id` la nivelul de sus).
test('writeLocalSnapshot cu o intrare attendance și una pool_sessions nu aruncă și scrie datele pe tabelele lor', () => {
  const database = harness();
  const syncState = createSyncStateRepository(database);

  writeLocalSnapshot(database, {
    records: {
      attendance: [
        {
          id: 'CHILD-1|2026-09-15',
          revision: 1,
          payload: {
            childId: 'CHILD-1',
            date: '2026-09-15',
            status: 'present',
            reason: '',
            updatedAt: '2026-09-15T08:00:00.000Z',
          },
          updatedAt: '2026-09-15T08:00:00.000Z',
        },
      ],
      pool_sessions: [
        {
          id: 'BOOK-1|2026-09-15',
          revision: 1,
          payload: {
            bookingId: 'BOOK-1',
            date: '2026-09-15',
            status: 'scheduled',
            updatedAt: '2026-09-15T08:00:00.000Z',
          },
          updatedAt: '2026-09-15T08:00:00.000Z',
        },
      ],
    },
    headSeq: 7,
  });

  const attendanceRow = database
    .prepare('SELECT * FROM attendance WHERE child_id=? AND date=?')
    .get('CHILD-1', '2026-09-15');
  assert.equal(attendanceRow?.status, 'present');
  const sessionRow = database
    .prepare('SELECT * FROM pool_sessions WHERE booking_id=? AND date=?')
    .get('BOOK-1', '2026-09-15');
  assert.equal(sessionRow?.status, 'scheduled');
  assert.deepEqual(syncState.get('attendance', 'CHILD-1|2026-09-15'), {
    kind: 'attendance',
    id: 'CHILD-1|2026-09-15',
    serverRevision: 1,
    updatedAt: '2026-09-15T08:00:00.000Z',
    updatedByDevice: '',
    updatedByName: '',
  });
});

// B-2 (audit 2026-09-29): readLocalSnapshot itera doar TYPES — prima încărcare a unei filiale
// nu urca niciodată prezența/bazinul, pierdute definitiv (outbox-ul captează doar scrierile
// de după conectare).
test('readLocalSnapshot include și prezența și datele de bazin, nu doar TYPES', () => {
  const database = harness();
  database
    .prepare('INSERT INTO attendance(child_id,date,status,reason,updated_at) VALUES(?,?,?,?,?)')
    .run('CHILD-1', '2026-09-10', 'present', '', '2026-09-10T07:30:00.000Z');
  database
    .prepare(
      'INSERT INTO pool_bookings(id,child_id,coach_id,weekday,time,start_date,end_date,archived_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',
    )
    .run('BOOK-1', 'CHILD-1', 'COACH-1', 1, '10:00', '2026-09-01', null, null, '2026-09-01T09:00:00.000Z');
  database
    .prepare('INSERT INTO pool_sessions(booking_id,date,status,updated_at) VALUES(?,?,?,?)')
    .run('BOOK-1', '2026-09-14', 'scheduled', '2026-09-14T09:00:00.000Z');
  database.prepare('INSERT INTO pool_closings(month,closed_at) VALUES(?,?)').run('2026-08', '2026-09-01T00:00:00.000Z');

  const snapshot = readLocalSnapshot(database, { now: () => new Date('2026-09-28T10:00:00.000Z') });

  const kinds = snapshot.entries.map(entry => entry.kind);
  assert.ok(kinds.includes('attendance'));
  assert.ok(kinds.includes('pool_bookings'));
  assert.ok(kinds.includes('pool_sessions'));
  assert.ok(kinds.includes('pool_closings'));

  const attendanceEntry = snapshot.entries.find(entry => entry.kind === 'attendance');
  assert.equal(attendanceEntry?.id, 'CHILD-1|2026-09-10');
  assert.equal(/** @type {any} */ (attendanceEntry?.payload).status, 'present');

  const sessionEntry = snapshot.entries.find(entry => entry.kind === 'pool_sessions');
  assert.equal(sessionEntry?.id, 'BOOK-1|2026-09-14');

  const closingEntry = snapshot.entries.find(entry => entry.kind === 'pool_closings');
  assert.equal(closingEntry?.id, '2026-08');
});
