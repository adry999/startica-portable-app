import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateState } from '#shared/domain/record-schema.mjs';
import { startTestApplication } from '#test-support/start-test-application.mjs';

// /api/record și /api/record-delete rămân deocamdată implementate în
// server/routes.mjs (portul spre createRecordEditingRoutes se face la
// integrare); comportamentul verificat aici trebuie să rămână identic după
// acea integrare, de-aia testele lovesc direct rutele HTTP, nu funcția.

async function startApplication(t) {
  return startTestApplication(t, { prefix: 'startica-record-editing-' });
}

const request = (state, revision) => ({ state, confirm: 'IMPORT', revision, requestId: randomUUID() });

const child = { id: 'ID-1', name: 'Ana', parent: 'Maria', phone: '', dueDay: 10, status: 'Activ' };
const group = { id: 'GRP-1', name: 'Grupa curcubeu', capacity: 12 };

test('creează o înregistrare nouă', async t => {
  const app = await startApplication(t);
  const state0 = await app.get('/api/state');
  const created = await app.post('/api/record', {
    type: 'children',
    mode: 'create',
    record: child,
    revision: state0.revision,
    requestId: randomUUID(),
  });
  assert.equal(created.status, 200, created.body.error);
  assert.deepEqual(
    created.body.state.children.map(c => c.id),
    [child.id],
  );
  assert.deepEqual(validateState(created.body.state), created.body.state);
});

test('refuză crearea cu un id deja folosit (409)', async t => {
  const app = await startApplication(t);
  const imported = await app.post(
    '/api/import',
    request({ children: [child], payments: [], expenses: [], groups: [], categories: [] }, 0),
  );
  assert.equal(imported.status, 200, imported.body.error);
  const conflict = await app.post('/api/record', {
    type: 'children',
    mode: 'create',
    record: child,
    revision: imported.body.revision,
    requestId: randomUUID(),
  });
  assert.equal(conflict.status, 409);
  assert.match(conflict.body.error, /ID deja folosit/);
});

test('refuză actualizarea unei înregistrări inexistente (409)', async t => {
  const app = await startApplication(t);
  const state0 = await app.get('/api/state');
  const result = await app.post('/api/record', {
    type: 'children',
    mode: 'update',
    record: child,
    revision: state0.revision,
    requestId: randomUUID(),
  });
  assert.equal(result.status, 409);
  assert.match(result.body.error, /nu mai există/);
});

test('actualizează o înregistrare existentă', async t => {
  const app = await startApplication(t);
  const imported = await app.post(
    '/api/import',
    request({ children: [child], payments: [], expenses: [], groups: [], categories: [] }, 0),
  );
  const updated = await app.post('/api/record', {
    type: 'children',
    mode: 'update',
    record: { ...child, name: 'Ana Maria' },
    revision: imported.body.revision,
    requestId: randomUUID(),
  });
  assert.equal(updated.status, 200, updated.body.error);
  assert.equal(updated.body.state.children[0].name, 'Ana Maria');
});

test('refuză o plată asociată unui copil inexistent', async t => {
  const app = await startApplication(t);
  const state0 = await app.get('/api/state');
  const payment = {
    id: 'PAY-1',
    date: '2026-09-01',
    childId: 'ID-INEXISTENT',
    amount: 100,
    tenders: [{ method: 'Cash', amount: 100 }],
  };
  const result = await app.post('/api/record', {
    type: 'payments',
    mode: 'create',
    record: payment,
    revision: state0.revision,
    requestId: randomUUID(),
  });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /Copilul asociat nu există/);
});

test('refuză o grupă cu nume duplicat, indiferent de literă mare/mică', async t => {
  const app = await startApplication(t);
  const imported = await app.post(
    '/api/import',
    request({ children: [], payments: [], expenses: [], groups: [group], categories: [] }, 0),
  );
  const result = await app.post('/api/record', {
    type: 'groups',
    mode: 'create',
    record: { id: 'GRP-2', name: 'grupa CURCUBEU', capacity: 5 },
    revision: imported.body.revision,
    requestId: randomUUID(),
  });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /Există deja o grupă cu acest nume/);
});

test('refuză ștergerea definitivă a unei înregistrări nearhivate', async t => {
  const app = await startApplication(t);
  const imported = await app.post(
    '/api/import',
    request({ children: [child], payments: [], expenses: [], groups: [], categories: [] }, 0),
  );
  const result = await app.post('/api/record-delete', {
    type: 'children',
    id: child.id,
    revision: imported.body.revision,
    requestId: randomUUID(),
  });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /arhivate pot fi șterse/);
});

test('refuză ștergerea definitivă a unui copil cu achitări', async t => {
  const app = await startApplication(t);
  const archivedChild = { ...child, archived: true };
  const payment = {
    id: 'PAY-1',
    date: '2026-09-01',
    childId: child.id,
    amount: 100,
    tenders: [{ method: 'Cash', amount: 100 }],
  };
  const imported = await app.post(
    '/api/import',
    request({ children: [archivedChild], payments: [payment], expenses: [], groups: [], categories: [] }, 0),
  );
  const result = await app.post('/api/record-delete', {
    type: 'children',
    id: child.id,
    revision: imported.body.revision,
    requestId: randomUUID(),
  });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /Șterge mai întâi achitările/);
});

test('șterge definitiv o înregistrare arhivată, cu backup înainte', async t => {
  const app = await startApplication(t);
  const archivedChild = { ...child, archived: true };
  const imported = await app.post(
    '/api/import',
    request({ children: [archivedChild], payments: [], expenses: [], groups: [], categories: [] }, 0),
  );
  const deleted = await app.post('/api/record-delete', {
    type: 'children',
    id: child.id,
    revision: imported.body.revision,
    requestId: randomUUID(),
  });
  assert.equal(deleted.status, 200, deleted.body.error);
  assert.deepEqual(deleted.body.state.children, []);
  assert.deepEqual(validateState(deleted.body.state), deleted.body.state);

  const backupFiles = readdirSync(join(app.dir, 'backups'));
  assert.ok(
    backupFiles.some(name => name.includes('inainte-') && name.includes('tergere')),
    `Ar trebui să existe o copie „inainte-ștergere definitivă” în backups/: ${backupFiles.join(', ')}`,
  );
});
