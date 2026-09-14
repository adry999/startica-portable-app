import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestApplication } from '#test-support/start-test-application.mjs';

test('/api/session întoarce un token de sesiune', async t => {
  const app = await startTestApplication(t, { prefix: 'startica-session-' });
  assert.ok(app.token && app.token.length > 0);
});

test('POST /api/state refuză scrierea cu 409 și un mesaj explicit', async t => {
  const app = await startTestApplication(t, { prefix: 'startica-session-' });
  const result = await app.post('/api/state', {});
  assert.equal(result.status, 409);
  assert.match(result.body.error, /versiune este veche/);
});

test('POST /api/shutdown răspunde 404 când nu este permisă oprirea', async t => {
  const app = await startTestApplication(t, { prefix: 'startica-session-' });
  const result = await app.post('/api/shutdown', {});
  assert.equal(result.status, 404);
  assert.match(result.body.error, /Operațiune inexistentă/);
});
