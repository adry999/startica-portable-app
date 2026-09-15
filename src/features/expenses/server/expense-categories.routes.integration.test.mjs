import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { validateState } from '#shared/domain/record-schema.mjs';
import { startTestApplication } from '#test-support/start-test-application.mjs';

async function startApplication(t) {
  return startTestApplication(t, { prefix: 'startica-expense-categories-' });
}

const category = { id: 'CAT-1', name: 'Chirie' };
const request = (state, revision) => ({ state, confirm: 'IMPORT', revision, requestId: randomUUID() });

test('Se poate șterge o categorie existentă; revizia crește și rămâne în istoric', async t => {
  const app = await startApplication(t);
  const imported = await app.post(
    '/api/import',
    request({ children: [], payments: [], expenses: [], groups: [], categories: [category], visits: [] }, 0),
  );
  assert.equal(imported.status, 200, imported.body.error);

  const deleted = await app.post('/api/category-delete', {
    id: category.id,
    revision: imported.body.revision,
    requestId: randomUUID(),
  });
  assert.equal(deleted.status, 200, deleted.body.error);
  assert.equal(deleted.body.revision, imported.body.revision + 1);
  assert.deepEqual(deleted.body.state.categories, []);
  assert.deepEqual(validateState(deleted.body.state), deleted.body.state);

  const audit = await app.get('/api/audit');
  const entry = audit.entries.find(entry => entry.recordType === 'categories' && entry.recordId === category.id);
  assert.ok(entry, 'Ștergerea categoriei apare în istoric.');
  assert.equal(entry.action, 'ștergere');
});

test('Ștergerea unei categorii inexistente este refuzată cu 409', async t => {
  const app = await startApplication(t);
  const imported = await app.post(
    '/api/import',
    request({ children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] }, 0),
  );
  assert.equal(imported.status, 200, imported.body.error);

  const deleted = await app.post('/api/category-delete', {
    id: 'CAT-INEXISTENT',
    revision: imported.body.revision,
    requestId: randomUUID(),
  });
  assert.equal(deleted.status, 409);
  assert.match(deleted.body.error, /nu mai există/i);
});
