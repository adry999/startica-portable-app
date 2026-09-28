import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { createApplication } from '#app/server/create-application.mjs';

export { createApplication };

export async function startTestApplication(t, options = {}) {
  // fetch explicit, cu implicit globalThis.fetch: testele Telegram (§4) dau un
  // fetch fals aici; create-application.mjs îl leagă la createTelegramService.
  const { prefix = 'startica-test-', fetch: fetchOverride = globalThis.fetch, ...applicationOptions } = options;
  const dir = mkdtempSync(join(tmpdir(), prefix));
  const app = createApplication({
    dataDir: join(dir, 'data'),
    backupDir: join(dir, 'backups'),
    // Registrul filialelor (filiale.json) trebuie să stea în directorul temporar al
    // testului, niciodată în rădăcina reală a proiectului (vezi #config/environment.mjs).
    home: dir,
    autoBackupIntervalMs: 0,
    fetch: fetchOverride,
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
  let token = (await (await fetch(origin + '/api/session')).json()).token;
  const get = path => fetch(origin + path).then(response => response.json());
  const rawPost = async (path, body) => {
    const response = await fetch(origin + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Startica-Token': token },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  // Tokenul e per context de filială (create-application.mjs, A-1 din audit): după un
  // /api/branches/select reușit (chiar din acest apel), tokenul de mai sus a devenit
  // stale — exact ca o filă reală, care reîncarcă pagina și primește unul nou. O
  // reîncercare o singură dată, cu tokenul reîmprospătat, ține testele existente
  // valabile fără să ascundă cazul unei file rămase cu adevărat pe tokenul vechi
  // (acela nu trece prin acest helper, ci prin fetch direct — vezi „filă rămasă…”).
  const post = async (path, body) => {
    const first = await rawPost(path, body);
    // Doar 403-ul gărzii de token (mesajul din request-guards.mjs), nu orice 403 de
    // business (PIN greșit, „General” neștergibil etc.) — altfel o reîncercare aici ar
    // consuma o a doua încercare reală dintr-o limitare gen „PIN greșit de 5 ori”.
    if (first.status !== 403 || !/Filiala s-a schimbat|Reîncarcă aplicația înainte de a salva/.test(first.body.error))
      return first;
    token = (await (await fetch(origin + '/api/session')).json()).token;
    return rawPost(path, body);
  };
  const postJson = (path, body) => post(path, body).then(result => result.body);
  return {
    app,
    dir,
    origin,
    get token() {
      return token;
    },
    get,
    post,
    postJson,
  };
}
