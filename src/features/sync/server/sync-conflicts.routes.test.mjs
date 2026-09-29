import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { createRevisionTransaction } from '#core/server/persistence/revision-transaction.mjs';
import { createRecordingAuditTrail } from '#test-support/recording-audit-trail.mjs';
import { createSyncOutboxRepository } from './sync-outbox.repository.mjs';
import { createSyncStateRepository } from './sync-state.repository.mjs';
import { createSyncConflictsRepository } from './sync-conflicts.repository.mjs';
import { createSyncConflictsRoutes } from './sync-conflicts.routes.mjs';

const NOW = () => new Date('2026-09-28T10:00:00.000Z');

function fakeBackups() {
  return {
    backup: () => ({ file: '', name: '', warning: '' }),
    autoBackup: () => ({ warning: '' }),
    health: () => ({ ok: true }),
  };
}

function createHarness() {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  const rawRecordRepository = createRecordRepository(database);
  const outbox = createSyncOutboxRepository(database, { now: NOW });
  const syncState = createSyncStateRepository(database);
  const conflicts = createSyncConflictsRepository(database, { now: NOW });
  const auditTrail = createRecordingAuditTrail();
  const { runRevisionTransaction } = createRevisionTransaction({
    database,
    recordRepository: rawRecordRepository,
    backups: fakeBackups(),
    auditTrail,
  });
  const noted = [];
  const engine = { noteLocalChange: () => noted.push(true) };
  const routes = createSyncConflictsRoutes({
    conflicts,
    outbox,
    syncState,
    rawRecordRepository,
    auditTrail,
    runRevisionTransaction,
    getEngine: () => engine,
  });
  /** @type {Record<string, (request?: any) => any>} */
  const byPath = Object.fromEntries(routes.map(route => [`${route.method} ${route.path}`, route.handle]));
  return { database, rawRecordRepository, outbox, syncState, conflicts, auditTrail, noted, byPath };
}

/** Pregătește un conflict parcat pe o fișă de copil, exact ca după un push respins. */
function seedConflict(harness, overrides = {}) {
  const { rawRecordRepository, outbox, conflicts } = harness;
  const local = { id: 'C-1', name: 'Ana', phone: '060', healthNotes: 'Astm' };
  rawRecordRepository.save('children', local);
  const changeId = 'change-1';
  outbox.enqueue({ kind: 'children', recordId: 'C-1', payload: local });
  const [row] = outbox.pending(10);
  // simulează push-ul: server-ul a răspuns conflict, deci rândul se parchează
  outbox.park(row.seq, row.changeId ?? changeId);
  const remote = { id: 'C-1', name: 'Ana', phone: '070', healthNotes: 'Alergii' };
  const conflictId = conflicts.insert({
    kind: 'children',
    recordId: 'C-1',
    localPayload: local,
    localUpdatedAt: '2026-09-28T09:00:00.000Z',
    remotePayload: remote,
    remoteRevision: 5,
    remoteUpdatedAt: '2026-09-28T09:30:00.000Z',
    remoteDeviceId: 'dev-b',
    remoteDeviceName: 'Calculator B',
    outboxSeq: row.seq,
    ...overrides,
  });
  return { conflictId, local, remote, outboxSeq: row.seq };
}

test('GET /api/sync/conflicts arată titlul, subtitlul și câmpurile diferite, cu notele medicale ascunse', () => {
  const harness = createHarness();
  seedConflict(harness);

  const { conflicts } = harness.byPath['GET /api/sync/conflicts']();
  assert.equal(conflicts.length, 1);
  const [entry] = conflicts;
  assert.equal(entry.kind, 'children');
  assert.equal(entry.recordId, 'C-1');
  assert.equal(entry.title, 'Ana');
  assert.equal(entry.remoteDeviceName, 'Calculator B');
  const phoneField = entry.fields.find(f => f.field === 'phone');
  assert.ok(phoneField);
  assert.equal(phoneField.differs, true);
  const notesField = entry.fields.find(f => f.field === 'healthNotes');
  assert.ok(notesField);
  assert.equal(notesField.local, '[date medicale]');
});

test('păstrarea variantei de pe alt calculator scrie fișa lui, revizia și o intrare în istoric', () => {
  const harness = createHarness();
  const { conflictId, remote, outboxSeq } = seedConflict(harness);

  const envelope = harness.byPath['POST /api/sync/conflicts/resolve']({
    body: { id: conflictId, choice: 'remote', revision: 0, requestId: 'req-0000000001' },
  });

  assert.equal(envelope.ok, true);
  // B-7: scrierea trece prin normalizeRecord, ca pull-ul — fișa scrisă are câmpurile
  // completate cu valorile implicite ale schemei, nu doar cele patru din fixture.
  assert.deepEqual(harness.rawRecordRepository.find('children', 'C-1'), normalizeRecord('children', remote));
  const stateEntry = harness.syncState.get('children', 'C-1');
  assert.ok(stateEntry);
  assert.equal(stateEntry.serverRevision, 5);
  assert.equal(harness.conflicts.find(conflictId), undefined, 'conflictul dispare după rezolvare');
  assert.equal(harness.outbox.pending(10).length, 0, 'rândul parcat nu mai există');
  assert.equal(harness.outbox.parked().length, 0);
  const entry = harness.auditTrail.changes.find(c => c.action.startsWith('conflict:'));
  assert.ok(entry);
  assert.match(entry.action, /Calculator B/);
});

test('varianta de pe alt calculator cu formă nevalidă e respinsă cu 409, nu scrisă direct (B-7)', () => {
  const harness = createHarness();
  const invalidRemote = { id: 'id invalid cu spații', name: 'Ana' };
  const { conflictId } = seedConflict(harness, { remotePayload: invalidRemote });

  assert.throws(
    () =>
      harness.byPath['POST /api/sync/conflicts/resolve']({
        body: { id: conflictId, choice: 'remote', revision: 0, requestId: 'req-0000000005' },
      }),
    /** @param {any} error */ error => error.status === 409,
  );
  assert.notDeepEqual(harness.rawRecordRepository.find('children', 'C-1'), invalidRemote, 'nu s-a scris nevalidat');
  assert.ok(harness.conflicts.find(conflictId), 'conflictul rămâne nerezolvat, ca tranzacția să poată fi reluată');
});

test('o editare locală după parcare nu blochează rezolvarea și trimite fișa curentă (B-3)', () => {
  const harness = createHarness();
  const { conflictId } = seedConflict(harness);

  // Cât timp conflictul era parcat, utilizatorul mai corectează o dată fișa Anei — exact
  // scenariul din audit (P2), care înainte de fix ajungea într-un al doilea rând pending
  // și făcea `unpark()` să arunce UNIQUE constraint failed.
  const editedLocal = { id: 'C-1', name: 'Ana', phone: '061', healthNotes: 'Astm' };
  harness.rawRecordRepository.save('children', editedLocal);
  harness.outbox.enqueue({ kind: 'children', recordId: 'C-1', payload: editedLocal });

  const envelope = harness.byPath['POST /api/sync/conflicts/resolve']({
    body: { id: conflictId, choice: 'local', revision: 0, requestId: 'req-0000000003' },
  });

  assert.equal(envelope.ok, true, 'rezolvarea nu aruncă (fără UNIQUE constraint)');
  const pending = harness.outbox.pending(10);
  assert.equal(pending.length, 1, 'un singur rând pending, nu unul duplicat');
  assert.deepEqual(pending[0].payload, editedLocal, 'trimite fișa curentă, nu payload-ul din momentul conflictului');
  assert.equal(pending[0].baseRevision, 5, 'baza devine revizia pe care a văzut-o serverul');
  assert.equal(harness.outbox.parked().length, 0);
});

test('păstrarea variantei locale re-trimite modificarea cu revizia serverului și intră în istoric', () => {
  const harness = createHarness();
  const { conflictId, local } = seedConflict(harness);

  const envelope = harness.byPath['POST /api/sync/conflicts/resolve']({
    body: { id: conflictId, choice: 'local', revision: 0, requestId: 'req-0000000002' },
  });

  assert.equal(envelope.ok, true);
  assert.deepEqual(harness.rawRecordRepository.find('children', 'C-1'), local, 'varianta locală rămâne neschimbată');
  assert.equal(harness.conflicts.find(conflictId), undefined);
  const pending = harness.outbox.pending(10);
  assert.equal(pending.length, 1, 'rândul redevine pending, ca să fie retrimis');
  assert.equal(pending[0].baseRevision, 5, 'baza devine revizia pe care a văzut-o serverul');
  assert.equal(harness.noted.length, 1, 'motorul e anunțat să trimită imediat');
  const entry = harness.auditTrail.changes.find(c => c.action.startsWith('conflict:'));
  assert.ok(entry);
  assert.match(entry.action, /acest calculator/);
});
