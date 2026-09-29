import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { createSyncOutboxRepository } from './sync-outbox.repository.mjs';

function createRepository() {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  return {
    database,
    outbox: createSyncOutboxRepository(database, { now: () => new Date('2026-09-27T10:00:00.000Z') }),
  };
}

test('enqueue scrie un rând pending cu revizia de bază 0, fără sync_state', () => {
  const { outbox } = createRepository();
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Ana' } });

  const [change] = outbox.pending();
  assert.equal(change.kind, 'children');
  assert.equal(change.recordId, 'CHILD-1');
  assert.equal(change.baseRevision, 0);
  assert.deepEqual(change.payload, { id: 'CHILD-1', name: 'Ana' });
  assert.equal(change.status, 'pending');
});

test('enqueue ia revizia de bază din sync_state, când există', () => {
  const { database, outbox } = createRepository();
  database
    .prepare('INSERT INTO sync_state VALUES(?,?,?,?,?,?)')
    .run('children', 'CHILD-1', 4, '2026-09-27T09:00:00.000Z', 'dev-1', 'Calculator A');

  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Ana' } });

  assert.equal(outbox.pending()[0].baseRevision, 4);
});

test('două modificări ale aceleiași fișe rămân un singur rând pending, cu ultimul payload și prima revizie de bază', () => {
  const { outbox } = createRepository();
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Ana' } });
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Ana Pop' } });

  const pending = outbox.pending();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].baseRevision, 0);
  assert.deepEqual(pending[0].payload, { id: 'CHILD-1', name: 'Ana Pop' });
  assert.equal(outbox.countPending(), 1);
});

test('o ștergere pune un rând cu payload null', () => {
  const { outbox } = createRepository();
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: null });

  assert.equal(outbox.pending()[0].payload, null);
});

test('markSent, park și unpark mută rândul în afara sau înapoi în pending', () => {
  const { outbox } = createRepository();
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1' } });
  const [{ seq, changeId }] = outbox.pending();

  assert.equal(outbox.park(seq, changeId), true);
  assert.equal(outbox.pending().length, 0);

  outbox.unpark(seq, 7);
  const [reparked] = outbox.pending();
  assert.equal(reparked.baseRevision, 7);
  assert.equal(reparked.status, 'pending');

  outbox.markSent([seq]);
  assert.equal(outbox.pending().length, 0);
});

test('remove șterge definitiv rândul', () => {
  const { outbox } = createRepository();
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1' } });
  const [{ seq, changeId }] = outbox.pending();

  assert.equal(outbox.remove(seq, changeId), true);

  assert.equal(outbox.countPending(), 0);
});

test('remove nu șterge rândul dacă a fost coalescat cu o modificare mai nouă (C-1)', () => {
  const { outbox } = createRepository();
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Ana' } });
  const [{ seq, changeId: changeIdTrimis }] = outbox.pending();

  // O a doua salvare locală, cât timp push-ul cu changeIdTrimis era în zbor: actualizează
  // rândul cu un change_id nou, exact ca outbox-recording-repository.mjs.
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Ana Popescu' } });

  assert.equal(outbox.remove(seq, changeIdTrimis), false, 'change_id-ul vechi nu mai corespunde');
  const [stillPending] = outbox.pending();
  assert.deepEqual(stillPending.payload, { id: 'CHILD-1', name: 'Ana Popescu' }, 'modificarea nouă nu s-a pierdut');
});

test('park nu parchează rândul dacă a fost coalescat cu o modificare mai nouă (C-1)', () => {
  const { outbox } = createRepository();
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Ana' } });
  const [{ seq, changeId: changeIdTrimis }] = outbox.pending();

  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Ana Popescu' } });

  assert.equal(outbox.park(seq, changeIdTrimis), false);
  assert.equal(outbox.pending().length, 1, 'rândul rămâne pending, nu parcat pentru un conflict vechi');
});

test('enqueue peste un rând parcat îi actualizează payload-ul, nu inserează un al doilea rând pending (B-3)', () => {
  const { outbox } = createRepository();
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Ana' } });
  const [{ seq, changeId }] = outbox.pending();
  outbox.park(seq, changeId);

  // O editare locală cât timp fișa era parcată cu un conflict nerezolvat.
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Ana Popescu' } });

  assert.equal(outbox.pending().length, 0, 'nu apare un al doilea rând pending');
  assert.equal(outbox.parked().length, 1, 'rândul rămâne parcat, cu un singur rând pentru fișă');
  const stillParked = outbox.findParked('children', 'CHILD-1');
  assert.ok(stillParked);
  assert.deepEqual(stillParked.payload, { id: 'CHILD-1', name: 'Ana Popescu' });

  // unpark (rezolvarea conflictului) nu mai lovește UNIQUE constraint, pentru că nu
  // există un al doilea rând pending pentru aceeași fișă.
  outbox.unpark(seq, 9);
  assert.equal(outbox.pending().length, 1);
  assert.equal(outbox.parked().length, 0);
});

test('unpark cu payload nou suprascrie fișa parcată, ca la rezolvarea „păstrează local” (B-3)', () => {
  const { outbox } = createRepository();
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Ana' } });
  const [{ seq, changeId }] = outbox.pending();
  outbox.park(seq, changeId);

  outbox.unpark(seq, 5, { id: 'CHILD-1', name: 'Ana curentă' });

  const [reparked] = outbox.pending();
  assert.deepEqual(reparked.payload, { id: 'CHILD-1', name: 'Ana curentă' });
  assert.equal(reparked.baseRevision, 5);
});

test('findPending vede doar rândul pending, nu cel parcat', () => {
  const { outbox } = createRepository();
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1' } });
  const [row] = outbox.pending();
  outbox.park(row.seq, row.changeId);

  assert.equal(outbox.findPending('children', 'CHILD-1'), undefined);
});

test('parked() și findParked() văd doar rândurile parcate', () => {
  const { outbox } = createRepository();
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1' } });
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-2', payload: { id: 'CHILD-2' } });
  const [row1] = outbox.pending();
  outbox.park(row1.seq, row1.changeId);

  assert.equal(outbox.parked().length, 1);
  assert.equal(outbox.parked()[0].recordId, 'CHILD-1');
  assert.ok(outbox.findParked('children', 'CHILD-1'));
  assert.equal(outbox.findParked('children', 'CHILD-2'), undefined);
});

test('pending respectă limita și ordinea de inserare', () => {
  const { outbox } = createRepository();
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1' } });
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-2', payload: { id: 'CHILD-2' } });
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-3', payload: { id: 'CHILD-3' } });

  const firstTwo = outbox.pending(2);
  assert.deepEqual(
    firstTwo.map(change => change.recordId),
    ['CHILD-1', 'CHILD-2'],
  );
});
