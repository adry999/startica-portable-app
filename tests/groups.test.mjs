import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApplication } from '../startica_server.mjs';
import { validateState } from '../shared/domain.mjs';

async function startApplication(t) {
  const dir = mkdtempSync(join(tmpdir(), 'startica-groups-'));
  const app = createApplication({ dataDir: join(dir, 'data'), backupDir: join(dir, 'backups'), autoBackupIntervalMs: 0 });
  await new Promise(done => app.server.listen(0, '127.0.0.1', done));
  t.after(async () => {
    await app.close();
    if (dirname(resolve(dir)) === resolve(tmpdir()) && basename(dir).startsWith('startica-groups-'))
      rmSync(dir, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  const token = (await (await fetch(origin + '/api/session')).json()).token;
  return {
    get: async path => (await fetch(origin + path)).json(),
    post: async (path, body) => {
      const response = await fetch(origin + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Startica-Token': token },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    },
  };
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
    request({ children: [archivedChild], payments: [], expenses: [], groups: [group], categories: [] }, 0),
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
    request({ children: [], payments: [], expenses: [], groups: [group], categories: [] }, 0),
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
