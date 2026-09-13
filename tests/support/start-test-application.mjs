import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { createApplication } from '../../startica_server.mjs';

export async function startTestApplication(t, options = {}) {
  const { prefix = 'startica-test-', ...applicationOptions } = options;
  const dir = mkdtempSync(join(tmpdir(), prefix));
  const app = createApplication({
    dataDir: join(dir, 'data'),
    backupDir: join(dir, 'backups'),
    autoBackupIntervalMs: 0,
    ...applicationOptions,
  });
  await new Promise(done => app.server.listen(0, '127.0.0.1', done));
  t.after(async () => {
    await app.close();
    // Nu ștergem decât folderul temporar creat mai sus, nu orice altă cale.
    if (dirname(resolve(dir)) === resolve(tmpdir()) && basename(dir).startsWith(prefix))
      rmSync(dir, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  const token = (await (await fetch(origin + '/api/session')).json()).token;
  const get = path => fetch(origin + path).then(response => response.json());
  const post = async (path, body) => {
    const response = await fetch(origin + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Startica-Token': token },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const postJson = (path, body) => post(path, body).then(result => result.body);
  return { app, dir, origin, token, get, post, postJson };
}
