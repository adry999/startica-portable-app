import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { AUDIT_PAGE_SIZE, createAuditLogRepository } from './audit-log.repository.mjs';

function createRepository(t) {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  t.after(() => database.close());
  return createAuditLogRepository(database);
}

function recordChildRenames(repository, count) {
  for (let number = 1; number <= count; number++)
    repository.recordChange({
      action: 'modificare',
      recordType: 'children',
      recordId: `CHILD-${number}`,
      before: { name: 'Vechi' },
      after: { name: `Nou ${number}` },
      occurredAt: new Date(Date.UTC(2026, 8, 1, 0, number)),
    });
}

test('prima pagină începe cu cea mai recentă modificare, cu valorile deserializate', t => {
  const repository = createRepository(t);
  recordChildRenames(repository, 2);

  const { entries, nextBeforeEntryId } = repository.readPage({ beforeEntryId: null });

  assert.deepEqual(
    entries.map(entry => entry.recordId),
    ['CHILD-2', 'CHILD-1'],
  );
  assert.deepEqual(entries[0].after, { name: 'Nou 2' });
  assert.equal(entries[0].occurredAt, '2026-09-01T00:02:00.000Z');
  assert.equal(nextBeforeEntryId, null);
});

test('o modificare salvată între două pagini nu dublează intrări', t => {
  const repository = createRepository(t);
  recordChildRenames(repository, AUDIT_PAGE_SIZE + 1);

  const firstPage = repository.readPage({ beforeEntryId: null });
  repository.recordChange({ action: 'adăugare', recordType: 'children', recordId: 'CHILD-NEW' });
  const secondPage = repository.readPage({ beforeEntryId: firstPage.nextBeforeEntryId });

  assert.equal(firstPage.entries.length, AUDIT_PAGE_SIZE);
  assert.deepEqual(
    secondPage.entries.map(entry => entry.recordId),
    ['CHILD-1'],
  );
  assert.equal(secondPage.nextBeforeEntryId, null);
});

test('o pagină plină, fără alte intrări, nu anunță pagină următoare', t => {
  const repository = createRepository(t);
  recordChildRenames(repository, AUDIT_PAGE_SIZE);

  assert.equal(repository.readPage({ beforeEntryId: null }).nextBeforeEntryId, null);
});

test('modificarea setărilor se păstrează fără tip și fără înregistrare', t => {
  const repository = createRepository(t);
  repository.recordChange({
    action: 'configurare backup',
    before: { externalDir: '' },
    after: { externalDir: 'D:\\Backup' },
  });

  const [entry] = repository.readPage({ beforeEntryId: null }).entries;

  assert.equal(entry.recordType, null);
  assert.equal(entry.recordId, null);
  assert.deepEqual(entry.before, { externalDir: '' });
});

test('refuză un cursor sau o acțiune invalidă', t => {
  const repository = createRepository(t);

  for (const beforeEntryId of [0, -1, 1.5, Number.NaN])
    assert.throws(() => repository.readPage({ beforeEntryId }), { status: 400 });
  assert.throws(() => repository.recordChange({ action: ' ' }), { status: 400 });
});

test('o modificare cu date medicale pe o vizită e păstrată redactată în istoric', t => {
  const repository = createRepository(t);
  repository.recordChange({
    action: 'modificare',
    recordType: 'visits',
    recordId: 'VIZ-1',
    before: { healthNotes: 'Alergie la nuci', name: 'Ana' },
    after: { healthNotes: '', name: 'Ana' },
  });

  const [entry] = repository.readPage({ beforeEntryId: null }).entries;

  assert.ok(entry.before);
  assert.ok(entry.after);
  assert.equal(entry.before.healthNotes, '[date medicale]');
  assert.equal(entry.after.healthNotes, '');
  assert.equal(entry.before.name, 'Ana');
});

test('o modificare cu date medicale pe un copil e păstrată redactată în istoric', t => {
  const repository = createRepository(t);
  repository.recordChange({
    action: 'modificare',
    recordType: 'children',
    recordId: 'CHILD-1',
    before: { healthNotes: 'Astm' },
    after: { healthNotes: 'Astm ușor' },
  });

  const [entry] = repository.readPage({ beforeEntryId: null }).entries;

  assert.ok(entry.before);
  assert.ok(entry.after);
  assert.equal(entry.before.healthNotes, '[date medicale]');
  assert.equal(entry.after.healthNotes, '[date medicale]');
});

test('redactarea nu atinge alte câmpuri sau alte tipuri de înregistrare', t => {
  const repository = createRepository(t);
  repository.recordChange({
    action: 'modificare',
    recordType: 'payments',
    recordId: 'PAY-1',
    before: { amount: 100 },
    after: { amount: 200 },
  });

  const [entry] = repository.readPage({ beforeEntryId: null }).entries;

  assert.deepEqual(entry.before, { amount: 100 });
  assert.deepEqual(entry.after, { amount: 200 });
});
