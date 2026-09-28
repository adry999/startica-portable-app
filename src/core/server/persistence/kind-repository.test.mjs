import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '../database/schema.mjs';
import { createKindRepository } from './kind-repository.mjs';

function createDatabase(t) {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  t.after(() => database.close());
  return database;
}

test('kind-repository salvează, citește și șterge pe kind și notifică onChange după COMMIT', t => {
  const database = createDatabase(t);
  const changes = [];
  const repository = createKindRepository(database, { onChange: change => changes.push(change) });

  const staff = { id: 'STF-1', name: 'Ana' };
  repository.save('staff', staff);
  assert.deepEqual(repository.find('staff', 'STF-1'), staff);
  assert.deepEqual(repository.list('staff'), [staff]);
  assert.deepEqual(changes, [{ kind: 'staff', id: 'STF-1', payload: staff }]);

  // Aceeași conexiune vede oricum propriile scrieri necomise (SQLite) — schimbarea
  // e vizibilă indiferent de momentul lui onChange; asta doar confirmă că e vizibilă.
  let visibleDuringOnChange;
  const repositoryWithReadback = createKindRepository(database, {
    onChange: () => {
      visibleDuringOnChange = repository.find('staff', 'STF-2');
    },
  });
  repositoryWithReadback.save('staff', { id: 'STF-2', name: 'Ion' });
  assert.deepEqual(visibleDuringOnChange, { id: 'STF-2', name: 'Ion' });

  repository.remove('staff', 'STF-1');
  assert.equal(repository.find('staff', 'STF-1'), undefined);
  assert.deepEqual(changes.at(-1), { kind: 'staff', id: 'STF-1', payload: null });

  // kind-uri diferite nu se amestecă la list().
  repository.save('roles', { id: 'ROL-1', name: 'Educator' });
  assert.deepEqual(
    repository.list('staff').map(record => record.id),
    ['STF-2'],
  );
});

test('onChange rulează abia după COMMIT: o eroare în el nu anulează scrierea (E-1 — permite un backup sincron în onChange)', t => {
  const database = createDatabase(t);
  const repository = createKindRepository(database, {
    onChange: () => {
      throw new Error('eroare în abonat');
    },
  });

  assert.throws(() => repository.save('staff', { id: 'STF-1', name: 'Ana' }), /eroare în abonat/);
  // Scrierea a fost deja confirmată (COMMIT) înainte ca onChange să arunce — altfel un
  // backup sincron (VACUUM INTO) declanșat din onChange ar arunca „cannot VACUUM from
  // within a transaction”, pentru că tranzacția scrierii ar fi încă deschisă.
  const readback = createKindRepository(database);
  assert.deepEqual(readback.find('staff', 'STF-1'), { id: 'STF-1', name: 'Ana' });
});

test('transaction(fn) grupează notificările onChange și le trimite o singură dată, după COMMIT', t => {
  const database = createDatabase(t);
  const changes = [];
  const repository = createKindRepository(database, { onChange: change => changes.push(change) });

  repository.transaction(() => {
    repository.save('timesheet', { id: 'TS-1', code: 'CO' });
    repository.save('timesheet', { id: 'TS-2', code: 'CM' });
    // Nicio notificare încă — tranzacția grupată nu s-a încheiat.
    assert.deepEqual(changes, []);
  });
  assert.equal(changes.length, 2);

  changes.length = 0;
  assert.throws(() => {
    repository.transaction(() => {
      repository.save('timesheet', { id: 'TS-3', code: 'A' });
      throw new Error('eroare în lot');
    });
  });
  // Rollback — nicio notificare pentru un lot care nu s-a scris niciodată.
  assert.deepEqual(changes, []);
});

test('transaction(fn) grupează mai multe scrieri într-o singură tranzacție, atomic la eroare', t => {
  const database = createDatabase(t);
  const repository = createKindRepository(database);

  repository.transaction(() => {
    repository.save('timesheet', { id: 'TS-1', code: 'CO' });
    repository.save('timesheet', { id: 'TS-2', code: 'CM' });
  });
  assert.equal(repository.list('timesheet').length, 2);

  assert.throws(() => {
    repository.transaction(() => {
      repository.save('timesheet', { id: 'TS-3', code: 'A' });
      throw new Error('eroare în lot');
    });
  });
  assert.equal(repository.find('timesheet', 'TS-3'), undefined);
});
