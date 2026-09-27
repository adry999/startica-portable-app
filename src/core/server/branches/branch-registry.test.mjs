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
