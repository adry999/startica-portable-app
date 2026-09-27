import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSyncDatabase } from './database.mjs';
import { createBranchesRepository } from './branches.repository.mjs';

function withRepository(t) {
  const dir = mkdtempSync(join(tmpdir(), 'sync-branches-test-'));
  const database = openSyncDatabase(dir);
  t.after(() => {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return createBranchesRepository(database);
}

test('register creează o filială nouă și e idempotent după id', t => {
  const branches = withRepository(t);
  const input = {
    id: 'branch-1',
    name: 'Filiala principală',
    color: '#f5a623',
    address: 'Str. Grădinițelor 1',
    createdAt: '2026-09-27T08:00:00.000Z',
    updatedAt: '2026-09-27T08:00:00.000Z',
    uploadedBy: 'dev-1',
    now: '2026-09-27T08:00:00.000Z',
  };
  const primul = branches.register(input);
  assert.equal(primul.created, true);
  assert.equal(primul.branch.name, 'Filiala principală');
  assert.equal(branches.count(), 1);

  const alDoilea = branches.register(input);
  assert.equal(alDoilea.created, false);
  assert.equal(branches.count(), 1);
});

test('metadata se actualizează doar când updatedAt primit e mai nou', t => {
  const branches = withRepository(t);
  branches.register({
    id: 'branch-1',
    name: 'Filiala principală',
    color: '#f5a623',
    address: 'Adresa veche',
    createdAt: '2026-09-27T08:00:00.000Z',
    updatedAt: '2026-09-27T08:00:00.000Z',
    now: '2026-09-27T08:00:00.000Z',
  });

  branches.register({
    id: 'branch-1',
    name: 'Filiala principală',
    color: '#f5a623',
    address: 'Adresă veche, retrimisă',
    createdAt: '2026-09-27T08:00:00.000Z',
    updatedAt: '2026-09-27T07:00:00.000Z', // mai vechi decât cel din bază
    now: '2026-09-27T09:00:00.000Z',
  });
  const dupaRetrimitere = branches.findById('branch-1');
  assert.ok(dupaRetrimitere);
  assert.equal(dupaRetrimitere.address, 'Adresa veche');

  branches.register({
    id: 'branch-1',
    name: 'Filiala principală',
    color: '#f5a623',
    address: 'Adresa nouă',
    createdAt: '2026-09-27T08:00:00.000Z',
    updatedAt: '2026-09-27T10:00:00.000Z', // mai nou
    now: '2026-09-27T10:00:00.000Z',
  });
  const dupaActualizare = branches.findById('branch-1');
  assert.ok(dupaActualizare);
  assert.equal(dupaActualizare.address, 'Adresa nouă');
});

test('list întoarce filialele în ordinea creării', t => {
  const branches = withRepository(t);
  branches.register({
    id: 'branch-1',
    name: 'A',
    color: '#111',
    address: 'a',
    createdAt: '2026-09-27T08:00:00.000Z',
    updatedAt: '2026-09-27T08:00:00.000Z',
    now: '2026-09-27T08:00:00.000Z',
  });
  branches.register({
    id: 'branch-2',
    name: 'B',
    color: '#222',
    address: 'b',
    createdAt: '2026-09-27T09:00:00.000Z',
    updatedAt: '2026-09-27T09:00:00.000Z',
    now: '2026-09-27T09:00:00.000Z',
  });
  assert.deepEqual(
    branches.list().map(branch => branch.id),
    ['branch-1', 'branch-2'],
  );
});
