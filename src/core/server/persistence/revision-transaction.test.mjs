import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { emptyState } from '#shared/domain/record-schema.mjs';
import { applySchema } from '../database/schema.mjs';
import { createRecordRepository } from './record-repository.mjs';
import { createRevisionTransaction } from './revision-transaction.mjs';

function createRecordingBackups() {
  const calls = [];
  return {
    calls,
    backup(reason) {
      calls.push({ fn: 'backup', reason });
      return { file: '', name: 'backup.db', warning: '' };
    },
    autoBackup() {
      calls.push({ fn: 'autoBackup' });
      return { warning: '' };
    },
    health() {
      return { ok: true };
    },
  };
}

function createRecordingAuditTrail() {
  const changes = [];
  return { changes, recordChange: change => changes.push(change) };
}

function createHarness(t) {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  t.after(() => database.close());
  const recordRepository = createRecordRepository(database);
  const backups = createRecordingBackups();
  const auditTrail = createRecordingAuditTrail();
  const transaction = createRevisionTransaction({ database, recordRepository, backups, auditTrail });
  return { database, recordRepository, backups, auditTrail, ...transaction };
}

test('o scriere reușită crește revizia, memorează requestId-ul, cheamă autoBackup și întoarce plicul cu warning și health', t => {
  const { runRevisionTransaction, recordRepository, database, backups } = createHarness(t);

  const result = runRevisionTransaction({ revision: 0, requestId: 'req-salvare-01' }, { action: 'salvare' }, () =>
    recordRepository.save('children', { id: 'CHILD-1', name: 'Ana' }),
  );

  assert.equal(result.ok, true);
  assert.equal(result.revision, 1);
  assert.deepEqual(result.state.children, [{ id: 'CHILD-1', name: 'Ana' }]);
  assert.equal(result.warning, '');
  assert.deepEqual(result.health, { ok: true });
  assert.ok(database.prepare('SELECT * FROM requests WHERE id=?').get('req-salvare-01'));
  assert.deepEqual(
    backups.calls.map(call => call.fn),
    ['autoBackup'],
  );
});

test('aceeași cerere, cu același conținut, se reia fără să ruleze din nou applyChanges', t => {
  const { runRevisionTransaction, recordRepository } = createHarness(t);
  let applyChangesCalls = 0;
  const request = { revision: 0, requestId: 'req-salvare-02' };
  const applyChanges = () => {
    applyChangesCalls++;
    recordRepository.save('children', { id: 'CHILD-1', name: 'Ana' });
  };

  const first = runRevisionTransaction(request, { action: 'salvare' }, applyChanges);
  const second = runRevisionTransaction(request, { action: 'salvare' }, applyChanges);

  assert.equal(applyChangesCalls, 1);
  assert.equal(second.replayed, true);
  assert.deepEqual(second.state, first.state);
  assert.equal(second.revision, first.revision);
});

test('aceeași cerere, cu conținut diferit, este refuzată cu 409', t => {
  const { runRevisionTransaction } = createHarness(t);
  const requestId = 'req-salvare-03';

  runRevisionTransaction({ revision: 0, requestId }, { action: 'salvare' }, () => {});
  assert.throws(
    () => runRevisionTransaction({ revision: 0, requestId, extra: 'alt conținut' }, { action: 'salvare' }, () => {}),
    {
      status: 409,
    },
  );
});

test('o revizie veche este refuzată cu 409 și fără backup', t => {
  const { runRevisionTransaction, backups } = createHarness(t);
  runRevisionTransaction({ revision: 0, requestId: 'req-salvare-04' }, { action: 'salvare' }, () => {});
  backups.calls.length = 0;

  assert.throws(
    () =>
      runRevisionTransaction(
        { revision: 0, requestId: 'req-salvare-05' },
        { action: 'ștergere definitivă', backupBefore: true },
        () => {},
      ),
    { status: 409 },
  );
  assert.deepEqual(backups.calls, []);
});

test('backupBefore cheamă backup cu numele acțiunii, înainte de applyChanges', t => {
  const { runRevisionTransaction, backups } = createHarness(t);
  let backupCallsBeforeApply = null;

  runRevisionTransaction(
    { revision: 0, requestId: 'req-salvare-06' },
    { action: 'ștergere definitivă', backupBefore: true },
    () => {
      backupCallsBeforeApply = [...backups.calls];
    },
  );

  assert.deepEqual(backupCallsBeforeApply, [{ fn: 'backup', reason: 'inainte-ștergere definitivă' }]);
});

test('o excepție în applyChanges anulează tranzacția: fără înregistrare, fără schimbare de revizie, fără cerere memorată', t => {
  const { runRevisionTransaction, recordRepository, database } = createHarness(t);

  assert.throws(() =>
    runRevisionTransaction({ revision: 0, requestId: 'req-salvare-07' }, { action: 'salvare' }, () => {
      recordRepository.save('children', { id: 'CHILD-1', name: 'Ana' });
      throw new Error('eroare de validare');
    }),
  );

  assert.equal(recordRepository.currentRevision(), 0);
  assert.equal(recordRepository.find('children', 'CHILD-1'), undefined);
  assert.equal(database.prepare('SELECT * FROM requests WHERE id=?').get('req-salvare-07'), undefined);
});

test('replaceAllRecords consemnează câte o schimbare în istoric doar pentru înregistrările care diferă', t => {
  const { replaceAllRecords, recordRepository, auditTrail } = createHarness(t);
  recordRepository.save('children', { id: 'CHILD-1', name: 'Ana' });
  recordRepository.save('children', { id: 'CHILD-2', name: 'Ioana' });

  const snapshot = {
    ...emptyState(),
    children: [
      { id: 'CHILD-1', name: 'Ana' },
      { id: 'CHILD-2', name: 'Ioana Pop' },
      { id: 'CHILD-3', name: 'Mihai' },
    ],
  };
  replaceAllRecords(snapshot, 'import');

  assert.deepEqual(auditTrail.changes.map(change => change.recordId).sort(), ['CHILD-2', 'CHILD-3']);
  assert.deepEqual(recordRepository.readSnapshot().children, snapshot.children);
});
