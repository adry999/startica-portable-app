import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { validateState } from '#shared/domain/record-schema.mjs';
import { startTestApplication } from '#test-support/start-test-application.mjs';

async function startApplication(t) {
  return startTestApplication(t, { prefix: 'startica-payer-aliases-' });
}

const request = (state, revision) => ({ state, confirm: 'IMPORT', revision, requestId: randomUUID() });

const child = { id: 'ID-1', name: 'Ana', parent: 'Maria', phone: '', dueDay: 10, status: 'Activ' };
const alias = {
  id: 'PAY-ALIAS-1',
  alias: 'Ion Popescu IBAN MD00XYZ',
  childId: child.id,
  createdAt: '2026-09-25T10:00:00.000Z',
};

test('șterge direct un plătitor reținut, fără arhivare prealabilă', async t => {
  const app = await startApplication(t);
  const imported = await app.post(
    '/api/import',
    request(
      { children: [child], payments: [], expenses: [], groups: [], categories: [], visits: [], payerAliases: [alias] },
      0,
    ),
  );
  assert.equal(imported.status, 200, imported.body.error);

  const deleted = await app.post('/api/payer-alias-delete', {
    id: alias.id,
    revision: imported.body.revision,
    requestId: randomUUID(),
  });
  assert.equal(deleted.status, 200, deleted.body.error);
  assert.deepEqual(deleted.body.state.payerAliases, []);
  assert.deepEqual(validateState(deleted.body.state), deleted.body.state);
});

test('refuză ștergerea unui plătitor reținut inexistent (409)', async t => {
  const app = await startApplication(t);
  const state0 = await app.get('/api/state');
  const deleted = await app.post('/api/payer-alias-delete', {
    id: 'PAY-ALIAS-inexistent',
    revision: state0.revision,
    requestId: randomUUID(),
  });
  assert.equal(deleted.status, 409);
  assert.match(deleted.body.error, /nu mai există/);
});
