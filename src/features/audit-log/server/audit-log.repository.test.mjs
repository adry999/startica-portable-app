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

test('45a: o notă medicală schimbată dintr-un text ne-gol în altul rămâne distinsă după redactare', t => {
  // Fără marcajul din markSensitiveFieldChanges, ambele părți ar redacta identic la „[date
  // medicale]” și listChangedFields (webapp) ar vedea câmpul „neschimbat” — exact bug-ul pe care
  // 45a cere să-l evite („notă medicală modificată”, fără conținut).
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
  assert.notEqual(entry.after.healthNotes, entry.before.healthNotes);
  assert.ok(String(entry.after.healthNotes).includes('date medicale'));
});

test('45a: o notă medicală nemodificată redactează identic pe ambele părți (fără fals-pozitiv)', t => {
  const repository = createRepository(t);
  repository.recordChange({
    action: 'modificare',
    recordType: 'children',
    recordId: 'CHILD-1',
    before: { healthNotes: 'Astm', name: 'Veche' },
    after: { healthNotes: 'Astm', name: 'Nouă' },
  });

  const [entry] = repository.readPage({ beforeEntryId: null }).entries;

  assert.ok(entry.before);
  assert.ok(entry.after);
  assert.equal(entry.before.healthNotes, '[date medicale]');
  assert.equal(entry.after.healthNotes, '[date medicale]');
});

test('recordChange întoarce id-ul intrării create (40b: UndoToast îl ține pentru POST /api/undo)', t => {
  const repository = createRepository(t);
  const id = repository.recordChange({ action: 'adăugare', recordType: 'expenses', recordId: 'E1' });
  assert.equal(typeof id, 'number');
  assert.ok(id > 0);
});

test('findById găsește o intrare după id, cu sessionToken (40b)', t => {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  t.after(() => database.close());
  const repository = createAuditLogRepository(database, { sessionToken: 'TOKEN-A' });

  const id = repository.recordChange({
    action: 'adăugare',
    recordType: 'expenses',
    recordId: 'E1',
    before: null,
    after: { id: 'E1', amount: 100 },
  });

  const entry = repository.findById(id);
  assert.ok(entry);
  assert.equal(entry.recordId, 'E1');
  assert.deepEqual(entry.after, { id: 'E1', amount: 100 });
  assert.equal(entry.sessionToken, 'TOKEN-A');
});

test('findById întoarce null pentru un id inexistent sau invalid', t => {
  const repository = createRepository(t);
  assert.equal(repository.findById(999999), null);
  assert.equal(repository.findById(0), null);
  assert.equal(repository.findById(-1), null);
  assert.equal(repository.findById(1.5), null);
});

test('fără sessionToken la construcție, intrările se salvează cu session_token null', t => {
  const repository = createRepository(t);
  const id = repository.recordChange({ action: 'adăugare', recordType: 'expenses', recordId: 'E1' });
  const entry = repository.findById(id);
  assert.ok(entry);
  assert.equal(entry.sessionToken, null);
});

test('readForScope: istoricul unui copil, filtrat pe tipul și id-ul lui, cel mai recent primul', t => {
  const repository = createRepository(t);
  repository.recordChange({ action: 'adăugare', recordType: 'children', recordId: 'CHILD-1' });
  repository.recordChange({ action: 'modificare', recordType: 'children', recordId: 'CHILD-2' });
  repository.recordChange({
    action: 'modificare',
    recordType: 'children',
    recordId: 'CHILD-1',
    before: { groupId: null },
    after: { groupId: 'G1' },
  });

  const { entries, nextBeforeEntryId } = repository.readForScope({
    scope: [{ recordType: 'children', recordId: 'CHILD-1' }],
    beforeEntryId: null,
  });

  assert.deepEqual(
    entries.map(entry => entry.recordId),
    ['CHILD-1', 'CHILD-1'],
  );
  assert.equal(nextBeforeEntryId, null);
});

test('readForScope: mai multe perechi (tip, id) — fișa unui copil cu achitările lui', t => {
  const repository = createRepository(t);
  repository.recordChange({ action: 'adăugare', recordType: 'children', recordId: 'CHILD-1' });
  repository.recordChange({ action: 'adăugare', recordType: 'payments', recordId: 'PAY-1' });
  // O altă achitare, a altui copil — nu trebuie să apară în scope-ul lui CHILD-1.
  repository.recordChange({ action: 'adăugare', recordType: 'payments', recordId: 'PAY-2' });

  const { entries } = repository.readForScope({
    scope: [
      { recordType: 'children', recordId: 'CHILD-1' },
      { recordType: 'payments', recordId: 'PAY-1' },
    ],
    beforeEntryId: null,
  });

  assert.deepEqual(entries.map(entry => entry.recordId).sort(), ['CHILD-1', 'PAY-1']);
});

test('readForScope: cursorul pe id nu dublează intrări între pagini', t => {
  const repository = createRepository(t);
  for (let number = 1; number <= 3; number++)
    repository.recordChange({ action: 'modificare', recordType: 'children', recordId: 'CHILD-1' });

  const scope = [{ recordType: 'children', recordId: 'CHILD-1' }];
  const firstId = repository.readForScope({ scope, beforeEntryId: null }).entries[0].id;
  const { entries } = repository.readForScope({ scope, beforeEntryId: firstId });

  assert.equal(entries.length, 2);
  assert.ok(entries.every(entry => entry.id < firstId));
});

test('readForScope: recordType null (personalul, salvat fără kind) se potrivește cu IS, nu =', t => {
  const repository = createRepository(t);
  repository.recordChange({ action: 'salariu', recordType: null, recordId: 'STAFF-1' });
  repository.recordChange({ action: 'configurare backup', recordType: null, recordId: null });

  const { entries } = repository.readForScope({
    scope: [{ recordType: null, recordId: 'STAFF-1' }],
    beforeEntryId: null,
  });

  assert.deepEqual(
    entries.map(entry => entry.recordId),
    ['STAFF-1'],
  );
});

test('readForScope: refuză un scope gol sau invalid', t => {
  const repository = createRepository(t);
  assert.throws(() => repository.readForScope({ scope: [], beforeEntryId: null }), { status: 400 });
  assert.throws(
    () => repository.readForScope({ scope: [{ recordType: 'children', recordId: '' }], beforeEntryId: null }),
    {
      status: 400,
    },
  );
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

test('§7 (36g): fără deviceId/deviceName la construcție, intrările au device null', t => {
  const repository = createRepository(t);
  repository.recordChange({ action: 'adăugare', recordType: 'children', recordId: 'CHILD-1' });
  const [entry] = repository.readPage({ beforeEntryId: null }).entries;
  assert.equal(entry.deviceId, null);
  assert.equal(entry.deviceName, null);
});

test('§7 (36g): cu deviceId/deviceName la construcție, fiecare intrare nouă le poartă', t => {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  t.after(() => database.close());
  const repository = createAuditLogRepository(database, { deviceId: 'DEV-A', deviceName: 'Calculator A' });

  repository.recordChange({ action: 'adăugare', recordType: 'children', recordId: 'CHILD-1' });
  const [entry] = repository.readPage({ beforeEntryId: null }).entries;

  assert.equal(entry.deviceId, 'DEV-A');
  assert.equal(entry.deviceName, 'Calculator A');
});

test('§7 (36g): recordChange pune o intrare în coada de sincronizare doar dacă sincronizarea e activă', t => {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  t.after(() => database.close());
  const enqueued = [];
  let syncEnabled = false;
  const outbox = { enqueue: change => enqueued.push(change) };
  const repository = createAuditLogRepository(database, {
    deviceId: 'DEV-A',
    deviceName: 'Calculator A',
    branchId: 'BRANCH-1',
    outbox,
    isSyncEnabled: () => syncEnabled,
  });

  repository.recordChange({
    action: 'adăugare',
    recordType: 'children',
    recordId: 'CHILD-1',
    after: { id: 'CHILD-1' },
  });
  assert.equal(enqueued.length, 0, 'fără sincronizare activă, nimic nu pleacă în coadă');

  syncEnabled = true;
  repository.recordChange({
    action: 'adăugare',
    recordType: 'children',
    recordId: 'CHILD-2',
    after: { id: 'CHILD-2' },
  });
  assert.equal(enqueued.length, 1);
  assert.equal(enqueued[0].kind, 'audit_log');
  assert.equal(enqueued[0].payload.deviceId, 'DEV-A');
  assert.equal(enqueued[0].payload.branchId, 'BRANCH-1');
  assert.equal(enqueued[0].payload.module, 'children');
  assert.equal(enqueued[0].payload.recordId, 'CHILD-2');
  // recordId-ul din outbox e entry_uid (UUID global), nu id-ul local (autoincrement) — altfel
  // două calculatoare ar genera aceeași „cheie” pentru intrări complet diferite.
  assert.notEqual(enqueued[0].recordId, undefined);
  assert.notEqual(String(enqueued[0].recordId), '1');
});

test('§7 (36g): mergeSyncedEntry scrie o intrare cu identitatea calculatorului de origine, redactată', t => {
  const repository = createRepository(t);
  repository.mergeSyncedEntry({
    entryUid: 'UID-1',
    deviceId: 'DEV-B',
    deviceName: 'Calculator B',
    action: 'modificare',
    recordType: 'visits',
    recordId: 'VIZ-1',
    before: { healthNotes: 'Alergie', name: 'Ana' },
    after: { healthNotes: '', name: 'Ana' },
    occurredAt: '2026-10-01T10:00:00.000Z',
  });

  const [entry] = repository.readPage({ beforeEntryId: null }).entries;
  assert.equal(entry.deviceId, 'DEV-B');
  assert.equal(entry.deviceName, 'Calculator B');
  assert.ok(entry.before);
  assert.equal(entry.before.healthNotes, '[date medicale]');
  assert.equal(entry.recordId, 'VIZ-1');
});

test('§7 (36g): mergeSyncedEntry e idempotent pe entry_uid — o reluare nu dublează rândul', t => {
  const repository = createRepository(t);
  /** @type {Parameters<typeof repository.mergeSyncedEntry>[0]} */
  const entry = {
    entryUid: 'UID-DUP',
    deviceId: 'DEV-B',
    deviceName: 'Calculator B',
    action: 'adăugare',
    recordType: 'children',
    recordId: 'CHILD-1',
    before: null,
    after: null,
    occurredAt: '2026-10-01T10:00:00.000Z',
  };
  repository.mergeSyncedEntry(entry);
  repository.mergeSyncedEntry(entry);

  assert.equal(repository.readPage({ beforeEntryId: null }).entries.length, 1);
});

test('§7 (36g): fila „Acces” — readAccessEvents vede doar acțiunile access.*, readPage le exclude', t => {
  const repository = createRepository(t);
  repository.recordChange({ action: 'access.pin_ok', recordType: null, recordId: 'payments' });
  repository.recordChange({ action: 'modificare', recordType: 'children', recordId: 'CHILD-1' });
  repository.recordChange({ action: 'access.blocked', recordType: null, recordId: 'personal' });

  const access = repository.readAccessEvents({ beforeEntryId: null }).entries;
  assert.deepEqual(
    access.map(entry => entry.action),
    ['access.blocked', 'access.pin_ok'],
  );

  const page = repository.readPage({ beforeEntryId: null }).entries;
  assert.deepEqual(
    page.map(entry => entry.action),
    ['modificare'],
  );
});
