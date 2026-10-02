import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readBranchRegistry, writeBranchRegistry, createBranchRegistryStore } from './branch-registry.mjs';

function tempRegistryFile(t) {
  const dir = mkdtempSync(join(tmpdir(), 'startica-branch-registry-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, 'filiale.json');
}

test('registrul lipsă dă null, cel corupt aruncă cu mesaj, cel valid se citește înapoi identic', t => {
  const file = tempRegistryFile(t);
  assert.equal(readBranchRegistry(file), null);

  writeFileSync(file, '{ nu e json');
  assert.throws(() => readBranchRegistry(file), /Registrul filialelor \(filiale\.json\) este corupt/);

  writeFileSync(file, JSON.stringify({ version: 1, lastBranchId: 'x', branches: 'nu e listă' }));
  assert.throws(() => readBranchRegistry(file), /structură necunoscută/);

  /** @type {import('./branch-registry.mjs').BranchRegistry} */
  const registry = {
    version: 1,
    lastBranchId: 'branch-1',
    branches: [
      {
        id: 'branch-1',
        name: 'Buiucani',
        color: 'orange',
        address: '',
        createdAt: '2026-09-27T00:00:00.000Z',
        folder: null,
      },
    ],
  };
  writeBranchRegistry(file, registry);
  assert.deepEqual(readBranchRegistry(file), registry);
});

test('un registru cu branches: [] este tratat ca corupt, nu ca „fără filiale”', t => {
  const file = tempRegistryFile(t);
  writeFileSync(file, JSON.stringify({ version: 1, lastBranchId: '', branches: [] }));
  assert.throws(() => readBranchRegistry(file), /structură necunoscută/);
});

test('un folder cu separator de cale sau „..” face registrul corupt', t => {
  const file = tempRegistryFile(t);
  const entry = {
    id: 'branch-1',
    name: 'Buiucani',
    color: 'orange',
    address: '',
    createdAt: '2026-09-27T00:00:00.000Z',
  };
  writeFileSync(
    file,
    JSON.stringify({ version: 1, lastBranchId: 'branch-1', branches: [{ ...entry, folder: '../etc' }] }),
  );
  assert.throws(() => readBranchRegistry(file), /structură necunoscută/);

  writeFileSync(
    file,
    JSON.stringify({ version: 1, lastBranchId: 'branch-1', branches: [{ ...entry, folder: 'a\\b' }] }),
  );
  assert.throws(() => readBranchRegistry(file), /structură necunoscută/);
});

test('add creează slug-ul din nume și adaugă -2 la coliziune', t => {
  const file = tempRegistryFile(t);
  let counter = 0;
  const store = createBranchRegistryStore({
    file,
    now: () => '2026-09-27T00:00:00.000Z',
    createId: () => `id-${++counter}`,
  });

  const first = store.add({ name: 'Botanica', address: 'Str. Florilor' });
  assert.equal(first.folder, 'botanica');
  assert.equal(first.color, 'orange');

  const second = store.add({ name: 'Botanica' });
  assert.equal(second.folder, 'botanica-2');
  assert.equal(store.list().length, 2);
});

test('ensure scrie registrul o singură dată', t => {
  const file = tempRegistryFile(t);
  let counter = 0;
  const store = createBranchRegistryStore({
    file,
    now: () => '2026-09-27T00:00:00.000Z',
    createId: () => `id-${++counter}`,
  });
  const initialBranch = { name: 'Filiala principală', color: 'orange', address: '', folder: null };

  const first = store.ensure(initialBranch);
  assert.equal(first.branches.length, 1);
  assert.equal(first.branches[0].folder, null);
  assert.equal(first.lastBranchId, first.branches[0].id);

  store.add({ name: 'Botanica' });
  const second = store.ensure(initialBranch);
  assert.equal(second.branches.length, 2, 'a doua chemare nu a rescris registrul peste filiala adăugată între timp');
});

test('update rescrie numele, culoarea sau adresa și refuză o filială inexistentă', t => {
  const file = tempRegistryFile(t);
  let counter = 0;
  const store = createBranchRegistryStore({
    file,
    now: () => '2026-09-27T00:00:00.000Z',
    createId: () => `id-${++counter}`,
  });
  const branch = store.add({ name: 'Botanica', address: 'Str. Veche' });

  const updated = store.update(branch.id, { color: 'mint', address: 'Str. Nouă' });
  assert.equal(updated.name, 'Botanica');
  assert.equal(updated.color, 'mint');
  assert.equal(updated.address, 'Str. Nouă');
  assert.equal(updated.folder, branch.folder, 'redenumirea nu mută folderul');

  assert.throws(() => store.update('id-inexistent', { color: 'mint' }), /inexistentă/);
});

test('adopt păstrează id-ul dat de server și calculează un folder unic', t => {
  const file = tempRegistryFile(t);
  let counter = 0;
  const store = createBranchRegistryStore({
    file,
    now: () => '2026-09-27T00:00:00.000Z',
    createId: () => `id-${++counter}`,
  });
  store.add({ name: 'Botanica' });

  const adopted = store.adopt({
    id: 'server-branch-1',
    name: 'Ciocana',
    color: 'mint',
    address: 'Str. Ciocana',
    createdAt: '2026-09-01T00:00:00.000Z',
  });

  assert.equal(adopted.id, 'server-branch-1', 'id-ul vine de la server, nu createId()');
  assert.equal(adopted.folder, 'ciocana');
  assert.equal(store.list().length, 2);
  assert.ok(store.find('server-branch-1'));
});

test('adopt cu folder: null păstrează folderul null (calculator nou, filiala goală)', t => {
  const file = tempRegistryFile(t);
  const store = createBranchRegistryStore({ file, now: () => '2026-09-27T00:00:00.000Z', createId: () => 'x' });
  store.ensure({ name: 'Filiala principală', color: 'orange', address: '', folder: null });

  const adopted = store.adopt(
    { id: 'server-branch-1', name: 'Ciocana', color: 'mint', address: '', createdAt: '2026-09-01T00:00:00.000Z' },
    { folder: null },
  );

  assert.equal(adopted.folder, null);
});

test('replaceEmpty schimbă id-ul filialei goale existente, păstrându-i folderul', t => {
  const file = tempRegistryFile(t);
  const store = createBranchRegistryStore({ file, now: () => '2026-09-27T00:00:00.000Z', createId: () => 'x' });
  const empty = store.ensure({ name: 'Filiala principală', color: 'orange', address: '', folder: null });
  const emptyId = empty.branches[0].id;

  const replaced = store.replaceEmpty(emptyId, {
    id: 'server-branch-1',
    name: 'Ciocana',
    color: 'mint',
    address: 'Str. Ciocana',
    createdAt: '2026-09-01T00:00:00.000Z',
  });

  assert.equal(replaced.id, 'server-branch-1');
  assert.equal(replaced.name, 'Ciocana');
  assert.equal(replaced.folder, null, 'folderul vechi (legacy, null) se păstrează');
  assert.equal(store.list().length, 1);
  assert.equal(readBranchRegistry(file)?.lastBranchId, 'server-branch-1', 'lastBranchId urmează filiala redenumită');
  assert.equal(store.find(emptyId), undefined);
});

test('replaceEmpty pe un id inexistent aruncă', t => {
  const file = tempRegistryFile(t);
  const store = createBranchRegistryStore({ file, now: () => '2026-09-27T00:00:00.000Z', createId: () => 'x' });
  store.ensure({ name: 'Filiala principală', color: 'orange', address: '', folder: null });

  assert.throws(
    () =>
      store.replaceEmpty('id-inexistent', {
        id: 'server-branch-1',
        name: 'Ciocana',
        color: 'mint',
        address: '',
        createdAt: '2026-09-01T00:00:00.000Z',
      }),
    /inexistentă/,
  );
});

test('replaceAll înlocuiește toată lista de filiale cu una nouă (42d: restaurare completă)', t => {
  const file = tempRegistryFile(t);
  const store = createBranchRegistryStore({ file, now: () => '2026-09-27T00:00:00.000Z', createId: () => 'x' });
  store.ensure({ name: 'Filiala veche, locală', color: 'orange', address: '', folder: null });

  const restored = [
    { id: 'br-active', name: 'Filiala principală', color: 'orange', address: '', createdAt: '2026-09-01', folder: null },
    { id: 'br-other', name: 'Botanica', color: 'mint', address: '', createdAt: '2026-09-02', folder: 'botanica' },
  ];
  store.replaceAll(restored, 'br-active');

  assert.deepEqual(store.list(), restored);
  assert.equal(readBranchRegistry(file).lastBranchId, 'br-active');
});

test('setLastBranchId schimbă doar câmpul lastBranchId', t => {
  const file = tempRegistryFile(t);
  let counter = 0;
  const store = createBranchRegistryStore({
    file,
    now: () => '2026-09-27T00:00:00.000Z',
    createId: () => `id-${++counter}`,
  });
  const a = store.add({ name: 'Buiucani' });
  const b = store.add({ name: 'Botanica' });

  store.setLastBranchId(b.id);
  assert.equal(readBranchRegistry(file)?.lastBranchId, b.id);
  assert.equal(store.list().length, 2);
  assert.ok(store.find(a.id));
});
