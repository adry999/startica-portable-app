import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { validateState } from '#shared/domain/record-schema.mjs';
import { startTestApplication } from '#test-support/start-test-application.mjs';

async function startApplication(t) {
  return startTestApplication(t, { prefix: 'startica-groups-' });
}

const group = { id: 'GRP-1', name: 'Grupa curcubeu', capacity: 12 };
const archivedChild = {
  id: 'COPIL-1',
  name: 'Copil arhivat',
  dueDay: 10,
  status: 'Activ',
  groupId: group.id,
  archived: true,
};
const request = (state, revision) => ({ state, confirm: 'IMPORT', revision, requestId: randomUUID() });

test('Nu se șterge grupa folosită de un copil arhivat; exportul și restaurarea rămân valide', async t => {
  const app = await startApplication(t);
  const imported = await app.post(
    '/api/import',
    request({ children: [archivedChild], payments: [], expenses: [], groups: [group], categories: [], visits: [] }, 0),
  );
  assert.equal(imported.status, 200, imported.body.error);
  const before = imported.body;

  const backup = await app.post('/api/backup', {});
  assert.equal(backup.status, 200, backup.body.error);
  const deleted = await app.post('/api/group-delete', {
    id: group.id,
    revision: before.revision,
    requestId: randomUUID(),
  });
  assert.equal(deleted.status, 400);
  assert.match(deleted.body.error, /copiii arhivați/i);

  const after = await app.get('/api/state');
  assert.equal(after.revision, before.revision, 'Ștergerea refuzată nu modifică revizia.');
  assert.deepEqual(after.state, before.state, 'Ștergerea refuzată nu modifică starea.');
  assert.deepEqual(validateState(after.state), after.state, 'Starea poate fi exportată și validată din nou.');

  const restored = await app.post('/api/restore', {
    name: backup.body.name,
    confirm: 'RESTAUREAZA',
    revision: after.revision,
    requestId: randomUUID(),
  });
  assert.equal(restored.status, 200, restored.body.error);
  assert.deepEqual(
    validateState(restored.body.state),
    restored.body.state,
    'Backupul se poate restaura fără referințe orfane.',
  );
});

test('Se poate șterge o grupă fără copii atribuiți', async t => {
  const app = await startApplication(t);
  const imported = await app.post(
    '/api/import',
    request({ children: [], payments: [], expenses: [], groups: [group], categories: [], visits: [] }, 0),
  );
  assert.equal(imported.status, 200, imported.body.error);

  const deleted = await app.post('/api/group-delete', {
    id: group.id,
    revision: imported.body.revision,
    requestId: randomUUID(),
  });
  assert.equal(deleted.status, 200, deleted.body.error);
  assert.equal(deleted.body.revision, imported.body.revision + 1);
  assert.deepEqual(deleted.body.state.groups, []);
  assert.deepEqual(validateState(deleted.body.state), deleted.body.state);
});
