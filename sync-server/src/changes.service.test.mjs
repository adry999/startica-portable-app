import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openSyncDatabase } from './database.mjs';
import { createDevicesRepository } from './devices.repository.mjs';
import { createChangesService } from './changes.service.mjs';
import { runBackupCycle } from './backup.service.mjs';

function withService(t) {
  const dir = mkdtempSync(join(tmpdir(), 'sync-changes-test-'));
  const database = openSyncDatabase(dir);
  t.after(() => {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const devices = createDevicesRepository(database);
  devices.insert({
    id: 'dev-a',
    name: 'Calculator A',
    os: 'Windows 11',
    tokenHash: 'hash-a',
    now: '2026-09-27T08:00:00.000Z',
  });
  devices.insert({
    id: 'dev-b',
    name: 'Calculator B',
    os: 'macOS',
    tokenHash: 'hash-b',
    now: '2026-09-27T08:00:00.000Z',
  });
  return { dir, database, devices, changes: createChangesService({ database, devices }) };
}

test('o modificare cu revizia curentă se aplică și crește revizia', t => {
  const { changes } = withService(t);
  const result = changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2026-09-27T09:00:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'children',
        recordId: 'ID-1',
        baseRevision: 0,
        payload: { id: 'ID-1', name: 'Ana' },
        changedAt: '2026-09-27T09:00:00.000Z',
      },
    ],
  });
  assert.deepEqual(result.results, [{ changeId: result.results[0].changeId, status: 'applied', revision: 1 }]);

  const alDoilea = changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2026-09-27T09:05:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'children',
        recordId: 'ID-1',
        baseRevision: 1,
        payload: { id: 'ID-1', name: 'Ana M.' },
        changedAt: '2026-09-27T09:05:00.000Z',
      },
    ],
  });
  assert.equal(alDoilea.results[0].status, 'applied');
  assert.equal(alDoilea.results[0].revision, 2);
});

test('aceeași fișă modificată de două calculatoare dă conflict cu varianta de pe server, fără să piardă nimic', t => {
  const { changes } = withService(t);
  changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2026-09-27T09:00:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'children',
        recordId: 'ID-1',
        baseRevision: 0,
        payload: { id: 'ID-1', name: 'Ana' },
        changedAt: '2026-09-27T09:00:00.000Z',
      },
    ],
  });

  // dev-b nu a văzut încă schimbarea lui dev-a: trimite tot cu baseRevision 0.
  const rezultat = changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-b',
    now: new Date('2026-09-27T09:01:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'children',
        recordId: 'ID-1',
        baseRevision: 0,
        payload: { id: 'ID-1', name: 'Ana B.' },
        changedAt: '2026-09-27T09:01:00.000Z',
      },
    ],
  });

  const [conflict] = rezultat.results;
  assert.equal(conflict.status, 'conflict');
  assert.equal(conflict.revision, 1);
  assert.ok(conflict.head);
  assert.deepEqual(conflict.head.payload, { id: 'ID-1', name: 'Ana' });
  assert.equal(conflict.head.updatedBy.id, 'dev-a');
  assert.equal(conflict.head.updatedBy.name, 'Calculator A');

  // varianta lui dev-a (câștigătoare) rămâne intactă pe server.
  const dupa = changes.pull({ branchId: 'branch-1', since: 0 });
  assert.equal(dupa.changes.length, 1);
  assert.deepEqual(dupa.changes[0].payload, { id: 'ID-1', name: 'Ana' });
});

test('două achitări noi cu id-uri diferite se aplică amândouă', t => {
  const { changes } = withService(t);
  const rezultat = changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2026-09-27T09:00:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'payments',
        recordId: 'PAY-1',
        baseRevision: 0,
        payload: { id: 'PAY-1', amount: 100 },
        changedAt: '2026-09-27T09:00:00.000Z',
      },
      {
        changeId: randomUUID(),
        kind: 'payments',
        recordId: 'PAY-2',
        baseRevision: 0,
        payload: { id: 'PAY-2', amount: 200 },
        changedAt: '2026-09-27T09:00:01.000Z',
      },
    ],
  });
  assert.deepEqual(
    rezultat.results.map(r => r.status),
    ['applied', 'applied'],
  );
});

test('o achitare editată pe două calculatoare: câștigă ultima modificare, cealaltă e superseded', t => {
  const { changes } = withService(t);
  changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2026-09-27T09:00:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'payments',
        recordId: 'PAY-1',
        baseRevision: 0,
        payload: { id: 'PAY-1', amount: 100 },
        changedAt: '2026-09-27T09:00:00.000Z',
      },
    ],
  });

  // dev-b editează aceeași achitare, cu un baseRevision vechi, dar o oră mai târzie.
  const rezultatB = changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-b',
    now: new Date('2026-09-27T10:00:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'payments',
        recordId: 'PAY-1',
        baseRevision: 0,
        payload: { id: 'PAY-1', amount: 150 },
        changedAt: '2026-09-27T10:00:00.000Z',
      },
    ],
  });
  assert.equal(rezultatB.results[0].status, 'applied');
  assert.equal(rezultatB.results[0].revision, 2);

  // dev-a mai încearcă, cu o modificare mai veche decât cea a lui dev-b: e superseded.
  const rezultatA = changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2026-09-27T09:30:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'payments',
        recordId: 'PAY-1',
        baseRevision: 0,
        payload: { id: 'PAY-1', amount: 120 },
        changedAt: '2026-09-27T09:30:00.000Z',
      },
    ],
  });
  const [superseded] = rezultatA.results;
  assert.equal(superseded.status, 'superseded');
  assert.equal(superseded.revision, 2);
  assert.ok(superseded.head);
  assert.deepEqual(superseded.head.payload, { id: 'PAY-1', amount: 150 });
});

test('reluarea unui changeId cu rezultat superseded întoarce și head, nu doar statusul (D-2)', t => {
  const { changes } = withService(t);
  changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2026-09-27T09:00:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'payments',
        recordId: 'PAY-1',
        baseRevision: 0,
        payload: { id: 'PAY-1', amount: 100 },
        changedAt: '2026-09-27T09:00:00.000Z',
      },
    ],
  });

  const changeIdVechi = randomUUID();
  const trimiteModificareaVeche = () =>
    changes.applyPush({
      branchId: 'branch-1',
      deviceId: 'dev-b',
      now: new Date('2026-09-27T08:00:00.000Z'),
      changes: [
        {
          changeId: changeIdVechi,
          kind: 'payments',
          recordId: 'PAY-1',
          baseRevision: 0,
          payload: { id: 'PAY-1', amount: 80 },
          changedAt: '2026-09-27T08:00:00.000Z', // mai vechi decât ce e deja pe server
        },
      ],
    });

  const primul = trimiteModificareaVeche();
  assert.equal(primul.results[0].status, 'superseded');
  assert.ok(primul.results[0].head);

  // răspunsul s-a pierdut pe rețea; clientul retrimite același changeId.
  const reluat = trimiteModificareaVeche();
  assert.equal(reluat.results[0].status, 'superseded');
  assert.ok(reluat.results[0].head, 'trebuie să întoarcă head, altfel rândul rămâne pending la nesfârșit');
  assert.deepEqual(reluat.results[0].head.payload, { id: 'PAY-1', amount: 100 });
});

test('un changeId reluat întoarce rezultatul memorat fără a scrie a doua oară', t => {
  const { changes } = withService(t);
  const changeId = randomUUID();
  const trimite = () =>
    changes.applyPush({
      branchId: 'branch-1',
      deviceId: 'dev-a',
      now: new Date('2026-09-27T09:00:00.000Z'),
      changes: [
        {
          changeId,
          kind: 'children',
          recordId: 'ID-1',
          baseRevision: 0,
          payload: { id: 'ID-1', name: 'Ana' },
          changedAt: '2026-09-27T09:00:00.000Z',
        },
      ],
    });

  const primul = trimite();
  const reluat = trimite();
  assert.deepEqual(primul.results, reluat.results);

  const dupa = changes.pull({ branchId: 'branch-1', since: 0 });
  assert.equal(dupa.changes.length, 1); // nu s-a scris a doua oară
});

test('pull întoarce doar modificările aplicate după cursor, în ordinea seq', t => {
  const { changes } = withService(t);
  changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2026-09-27T09:00:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'children',
        recordId: 'ID-1',
        baseRevision: 0,
        payload: { id: 'ID-1' },
        changedAt: '2026-09-27T09:00:00.000Z',
      },
      {
        changeId: randomUUID(),
        kind: 'children',
        recordId: 'ID-2',
        baseRevision: 0,
        payload: { id: 'ID-2' },
        changedAt: '2026-09-27T09:00:01.000Z',
      },
    ],
  });
  const primaPagina = changes.pull({ branchId: 'branch-1', since: 0, limit: 1 });
  assert.equal(primaPagina.changes.length, 1);
  assert.equal(primaPagina.changes[0].recordId, 'ID-1');
  assert.ok(primaPagina.nextSince < primaPagina.headSeq);

  const aDouaPagina = changes.pull({ branchId: 'branch-1', since: primaPagina.nextSince });
  assert.equal(aDouaPagina.changes.length, 1);
  assert.equal(aDouaPagina.changes[0].recordId, 'ID-2');
  assert.equal(aDouaPagina.nextSince, aDouaPagina.headSeq);

  // o altă filială nu vede modificările acesteia.
  const altaFiliala = changes.pull({ branchId: 'branch-2', since: 0 });
  assert.equal(altaFiliala.changes.length, 0);
});

test('snapshot pe o filială cu date dă 409', t => {
  const { changes } = withService(t);
  changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2026-09-27T09:00:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'children',
        recordId: 'ID-1',
        baseRevision: 0,
        payload: { id: 'ID-1' },
        changedAt: '2026-09-27T09:00:00.000Z',
      },
    ],
  });
  assert.throws(
    () =>
      changes.writeSnapshot({
        branchId: 'branch-1',
        deviceId: 'dev-b',
        now: new Date('2026-09-27T10:00:00.000Z'),
        entries: [{ kind: 'children', id: 'ID-2', payload: { id: 'ID-2' }, updatedAt: '2026-09-27T10:00:00.000Z' }],
      }),
    /** @param {Error & { status?: number }} error */ error => error.status === 409,
  );
});

test('snapshot pe o filială nouă scrie fiecare rând la revizia 1 și se poate citi înapoi', t => {
  const { changes } = withService(t);
  const { headSeq } = changes.writeSnapshot({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2026-09-27T09:00:00.000Z'),
    entries: [
      { kind: 'children', id: 'ID-1', payload: { id: 'ID-1', name: 'Ana' }, updatedAt: '2026-09-27T09:00:00.000Z' },
      { kind: 'payments', id: 'PAY-1', payload: { id: 'PAY-1', amount: 100 }, updatedAt: '2026-09-27T09:00:00.000Z' },
    ],
  });
  assert.equal(headSeq, 2);
  const snapshot = changes.readSnapshot({ branchId: 'branch-1' });
  assert.equal(snapshot.records.children[0].revision, 1);
  assert.equal(snapshot.records.payments[0].id, 'PAY-1');
  assert.equal(snapshot.headSeq, 2);
});

test('un cursor mai vechi decât istoricul păstrat dă 410', t => {
  const { database, changes, dir } = withService(t);
  changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2020-01-01T09:00:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'children',
        recordId: 'ID-1',
        baseRevision: 0,
        payload: { id: 'ID-1' },
        changedAt: '2020-01-01T09:00:00.000Z',
      },
    ],
  });
  // schimbă retroactiv received_at, ca și cum rândul ar fi vechi de câțiva ani.
  database.prepare("UPDATE changes SET received_at='2020-01-01T09:00:00.000Z'").run();
  runBackupCycle({ database, dataDir: dir, keep: 14, historyDays: 365, now: new Date('2026-09-27T03:00:00.000Z') });

  assert.throws(
    () => changes.pull({ branchId: 'branch-1', since: 0 }),
    /** @param {Error & { status?: number }} error */ error => error.status === 410,
  );
});

test('410 e per filială: curățarea istoricului lui branch-1 nu dă 410 unei filiale liniștite (D-4)', t => {
  const { database, changes, dir } = withService(t);
  changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2020-01-01T09:00:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'children',
        recordId: 'ID-1',
        baseRevision: 0,
        payload: { id: 'ID-1' },
        changedAt: '2020-01-01T09:00:00.000Z',
      },
    ],
  });
  database.prepare("UPDATE changes SET received_at='2020-01-01T09:00:00.000Z' WHERE branch_id='branch-1'").run();
  runBackupCycle({ database, dataDir: dir, keep: 14, historyDays: 365, now: new Date('2026-09-27T03:00:00.000Z') });

  assert.throws(
    () => changes.pull({ branchId: 'branch-1', since: 0 }),
    /** @param {Error & { status?: number }} error */ error => error.status === 410,
  );
  // branch-2 nu are nimic curățat: cursorul 0 trebuie să meargă normal, nu 410.
  assert.doesNotThrow(() => changes.pull({ branchId: 'branch-2', since: 0 }));
});

// §5.3 — filtrare de profil pe push/pull/snapshot

test('push: o modificare pe un modul interzis e respinsă pe rând, nu oprește restul lotului', t => {
  const { devices, changes } = withService(t);
  devices.setProfile('dev-a', { preset: 'educator' }); // Prezența Modifică, restul Nu vede
  const rezultat = changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2026-09-27T09:00:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'payments', // nepermis pe Educator
        recordId: 'PAY-1',
        baseRevision: 0,
        payload: { id: 'PAY-1', amount: 100 },
        changedAt: '2026-09-27T09:00:00.000Z',
      },
      {
        changeId: randomUUID(),
        kind: 'attendance', // permis, Modifică
        recordId: 'ATT-1',
        baseRevision: 0,
        payload: { childId: 'ID-1', date: '2026-09-27', status: 'present' },
        changedAt: '2026-09-27T09:00:00.000Z',
      },
    ],
  });
  assert.equal(rezultat.results[0].status, 'rejected');
  assert.equal(rezultat.results[1].status, 'applied');
  // modificarea respinsă n-a scris nimic în records — un pull ulterior pe un profil Complet nu o vede.
  const dupa = changes.pull({ branchId: 'branch-1', since: 0 });
  assert.equal(dupa.changes.filter(change => change.kind === 'payments').length, 0);
});

test('push: un dispozitiv blocat nu poate scrie nimic', t => {
  const { devices, changes } = withService(t);
  devices.setProfile('dev-a', { preset: 'complet', blocked: true });
  const rezultat = changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2026-09-27T09:00:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'children',
        recordId: 'ID-1',
        baseRevision: 0,
        payload: { id: 'ID-1' },
        changedAt: '2026-09-27T09:00:00.000Z',
      },
    ],
  });
  assert.equal(rezultat.results[0].status, 'rejected');
});

test('push: audit_log e append-only — o a doua încercare pe același recordId e respinsă', t => {
  const { changes } = withService(t);
  const recordId = randomUUID();
  const prima = changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2026-09-27T09:00:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'audit_log',
        recordId,
        baseRevision: 0,
        payload: { action: 'creare' },
        changedAt: '2026-09-27T09:00:00.000Z',
      },
    ],
  });
  assert.equal(prima.results[0].status, 'applied');

  const aDoua = changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2026-09-27T09:01:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'audit_log',
        recordId, // același id — o „actualizare”, interzisă
        baseRevision: 0,
        payload: { action: 'modificat' },
        changedAt: '2026-09-27T09:01:00.000Z',
      },
    ],
  });
  assert.equal(aDoua.results[0].status, 'rejected');
});

test('push: audit_log se poate trimite de pe orice profil ne-blocat, inclusiv unul fără acces la admin', t => {
  const { devices, changes } = withService(t);
  devices.setProfile('dev-a', { preset: 'bazin' }); // admin = 0
  const rezultat = changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2026-09-27T09:00:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'audit_log',
        recordId: randomUUID(),
        baseRevision: 0,
        payload: { action: 'prezenta-bazin' },
        changedAt: '2026-09-27T09:00:00.000Z',
      },
    ],
  });
  assert.equal(rezultat.results[0].status, 'applied');
});

test('pull: un profil restrâns nu primește modificările de pe module nepermise', t => {
  const { devices, changes } = withService(t);
  changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2026-09-27T09:00:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'payments',
        recordId: 'PAY-1',
        baseRevision: 0,
        payload: { id: 'PAY-1', amount: 100 },
        changedAt: '2026-09-27T09:00:00.000Z',
      },
      {
        changeId: randomUUID(),
        kind: 'children',
        recordId: 'ID-1',
        baseRevision: 0,
        payload: { id: 'ID-1', name: 'Ana' },
        changedAt: '2026-09-27T09:00:01.000Z',
      },
    ],
  });
  devices.setProfile('dev-b', { preset: 'educator' });
  const rezultat = changes.pull({ branchId: 'branch-1', since: 0, deviceId: 'dev-b' });
  assert.deepEqual(
    rezultat.changes.map(change => change.kind),
    ['children'],
  );
  // cursorul avansează pe tot lotul, nu doar pe ce s-a văzut — altfel ar rămâne blocat pe `payments`.
  assert.equal(rezultat.nextSince, rezultat.headSeq);
});

test('pull: audit_log ajunge doar la un profil Complet', t => {
  const { devices, changes } = withService(t);
  changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2026-09-27T09:00:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'audit_log',
        recordId: randomUUID(),
        baseRevision: 0,
        payload: { action: 'x' },
        changedAt: '2026-09-27T09:00:00.000Z',
      },
    ],
  });
  devices.setProfile('dev-b', { preset: 'bazin' });
  assert.equal(changes.pull({ branchId: 'branch-1', since: 0, deviceId: 'dev-b' }).changes.length, 0);
  assert.equal(changes.pull({ branchId: 'branch-1', since: 0, deviceId: 'dev-a' }).changes.length, 1); // dev-a e Complet (implicit)
});

test('pull: children pierde healthNotes/feeHistory când Achitări = 0, dar păstrează restul', t => {
  const { devices, changes } = withService(t);
  changes.applyPush({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2026-09-27T09:00:00.000Z'),
    changes: [
      {
        changeId: randomUUID(),
        kind: 'children',
        recordId: 'ID-1',
        baseRevision: 0,
        payload: { id: 'ID-1', name: 'Ana', healthNotes: 'Astm', feeHistory: [{ amount: 100 }] },
        changedAt: '2026-09-27T09:00:00.000Z',
      },
    ],
  });
  devices.setProfile('dev-b', { preset: 'educator' }); // children=Vede, payments=0
  const rezultat = changes.pull({ branchId: 'branch-1', since: 0, deviceId: 'dev-b' });
  const payload = /** @type {{ name: string, healthNotes?: string, feeHistory?: unknown }} */ (
    rezultat.changes[0].payload
  );
  assert.equal(payload.name, 'Ana');
  assert.equal(payload.healthNotes, undefined);
  assert.equal(payload.feeHistory, undefined);
});

test('readSnapshot: filtrează kind-urile nepermise și redactează children (36e)', t => {
  const { devices, changes } = withService(t);
  changes.writeSnapshot({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2026-09-27T09:00:00.000Z'),
    entries: [
      {
        kind: 'children',
        id: 'ID-1',
        payload: { id: 'ID-1', healthNotes: 'Astm' },
        updatedAt: '2026-09-27T09:00:00.000Z',
      },
      { kind: 'payments', id: 'PAY-1', payload: { id: 'PAY-1', amount: 100 }, updatedAt: '2026-09-27T09:00:00.000Z' },
    ],
  });
  devices.setProfile('dev-b', { preset: 'educator' });
  const snapshot = changes.readSnapshot({ branchId: 'branch-1', deviceId: 'dev-b' });
  assert.ok(snapshot.records.children);
  const payload = /** @type {{ healthNotes?: string }} */ (snapshot.records.children[0].payload);
  assert.equal(payload.healthNotes, undefined);
  assert.equal(snapshot.records.payments, undefined);
});

test('writeSnapshot: intrările pe module nepermise sunt sărite, nu opresc restul instantaneului', t => {
  const { devices, changes } = withService(t);
  // Bazin: Modifică pe `pool`, doar Vede pe `children` — o încărcare de instantaneu cere
  // Modifică (scrie date noi), deci și intrările `children` se sar, nu doar `payments`.
  devices.setProfile('dev-a', { preset: 'bazin' });
  const { headSeq, skipped } = changes.writeSnapshot({
    branchId: 'branch-1',
    deviceId: 'dev-a',
    now: new Date('2026-09-27T09:00:00.000Z'),
    entries: [
      { kind: 'pool_bookings', id: 'BK-1', payload: { id: 'BK-1' }, updatedAt: '2026-09-27T09:00:00.000Z' },
      { kind: 'children', id: 'ID-1', payload: { id: 'ID-1' }, updatedAt: '2026-09-27T09:00:00.000Z' },
      { kind: 'payments', id: 'PAY-1', payload: { id: 'PAY-1', amount: 1 }, updatedAt: '2026-09-27T09:00:00.000Z' },
    ],
  });
  assert.equal(headSeq, 1);
  assert.deepEqual(skipped, ['ID-1', 'PAY-1']);
  const snapshot = changes.readSnapshot({ branchId: 'branch-1' });
  assert.ok(snapshot.records.pool_bookings);
  assert.equal(snapshot.records.children, undefined);
  assert.equal(snapshot.records.payments, undefined);
});
