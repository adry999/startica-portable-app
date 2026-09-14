import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestApplication } from '#test-support/start-test-application.mjs';

test('GET /api/diagnostic răspunde 404 fără allowShutdown', async t => {
  const bundle = await startTestApplication(t, { prefix: 'startica-diagnostic-' });
  const response = await fetch(bundle.origin + '/api/diagnostic');
  assert.equal(response.status, 404);
});

test('GET /api/diagnostic întoarce starea aplicației, fără jurnal când nu există home', async t => {
  const bundle = await startTestApplication(t, { prefix: 'startica-diagnostic-', allowShutdown: true });
  const response = await bundle.get('/api/diagnostic');
  assert.equal(response.home, '');
  assert.deepEqual(response.log, []);
  assert.equal(response.node, process.version);
  assert.equal(response.platform, process.platform);
  assert.ok(response.database.endsWith('startica.db'));
  assert.ok(response.backupDirectory.length > 0);
  assert.equal(typeof response.schemaVersion, 'number');
  assert.equal(response.health.ok, true);
  assert.deepEqual(response.backups, []);
});

test('GET /api/diagnostic citește ultimele 200 de linii din jurnal și ultimele backupuri', async t => {
  const home = mkdtempSync(join(tmpdir(), 'startica-diagnostic-home-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  mkdirSync(join(home, 'Jurnale'), { recursive: true });
  const lines = Array.from({ length: 205 }, (_, i) => `linia ${i}`);
  writeFileSync(join(home, 'Jurnale', 'startica.log'), lines.join('\n') + '\n');
  const bundle = await startTestApplication(t, { prefix: 'startica-diagnostic-', allowShutdown: true, home });
  await bundle.post('/api/backup', {});
  const response = await bundle.get('/api/diagnostic');
  assert.equal(response.home, home);
  assert.equal(response.log.length, 200);
  assert.equal(response.log[0], 'linia 5');
  assert.equal(response.log.at(-1), 'linia 204');
  assert.ok(response.backups.length >= 1 && response.backups.length <= 10);
  assert.ok(response.backups.every(name => typeof name === 'string'));
});
