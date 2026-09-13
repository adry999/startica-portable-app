import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { isModule } from '../server/http.mjs';
import { startTestApplication } from './support/start-test-application.mjs';

const BROWSER_MODULES = [
  '/ui/views.mjs',
  '/shared/domain.mjs',
  '/src/app/web/main.mjs',
  '/src/core/web/api-client.mjs',
  '/src/shared/format/money-format.mjs',
  '/src/shared/ui/child-picker.mjs',
  '/src/features/audit-log/index.web.mjs',
  '/src/features/audit-log/web/audit-log.controller.mjs',
  '/src/features/audit-log/domain/audit-change-diff.mjs',
];

const PRIVATE_PATHS = [
  '/src/features/audit-log/index.server.mjs',
  '/src/features/audit-log/server/audit-log.repository.mjs',
  '/src/core/server/errors/domain-error.mjs',
  '/src/app/server/main.mjs',
  '/src/config/environment.mjs',
  '/src/features/audit-log/web/audit-log.controller.test.mjs',
  '/src/features/payment-assignment/test-support/assignment-fixtures.mjs',
  '/src/features/audit-log/audit-log.types.d.mts',
  '/src/features/index.web.mjs',
  '/src/shared/../server/store.mjs',
  '/src/shared/%2e%2e/server/store.mjs',
  '/src/shared//money-format.mjs',
  '/src/shared/Format/money-format.mjs',
  '/src/shared/format/money-format.js',
  '/src/shared/format/.mjs',
  '/src/main.mjs',
  '/server/store.mjs',
];

/** Cerere fără normalizarea căii pe care o face fetch(). */
const rawGet = (origin, rawPath) =>
  new Promise((resolve, reject) => {
    const { hostname, port } = new URL(origin);
    request({ hostname, port, path: rawPath, method: 'GET' }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => (body += chunk));
      response.on('end', () =>
        resolve({ status: response.statusCode, contentType: response.headers['content-type'], body }),
      );
    })
      .on('error', reject)
      .end();
  });

function createSourceRoot(t) {
  const root = mkdtempSync(join(tmpdir(), 'startica-source-root-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const writeSource = (path, content) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  writeSource('src/shared/format/alias-probe.mjs', "export const aliasProbe = 'browser';");
  writeSource('src/features/audit-log/server/audit-log.repository.mjs', "export const serverOnly = 'secret';");
  return root;
}

test('lista albă acceptă doar modulele de browser', () => {
  for (const path of BROWSER_MODULES) assert.equal(isModule(path), true, path);
  for (const path of PRIVATE_PATHS) assert.equal(isModule(path), false, path);
});

test('serverul livrează modulele de browser din src/ și refuză codul de server, traversarea și fișierele lipsă', async t => {
  const root = createSourceRoot(t);
  const { origin } = await startTestApplication(t, { prefix: 'startica-http-modules-', root });

  const served = await rawGet(origin, '/src/shared/format/alias-probe.mjs');
  assert.equal(served.status, 200);
  assert.match(served.contentType, /^text\/javascript/);
  assert.match(served.body, /aliasProbe/);

  for (const path of [
    '/src/features/audit-log/server/audit-log.repository.mjs',
    '/src/shared/format/%2e%2e/%2e%2e/features/audit-log/server/audit-log.repository.mjs',
    '/src/shared/format/../../features/audit-log/server/audit-log.repository.mjs',
    '/src/shared/format/missing.mjs',
  ]) {
    const refused = await rawGet(origin, path);
    assert.equal(refused.status, 404, path);
    assert.doesNotMatch(refused.body, /secret/, path);
  }
});

test('pagina principală permite doar import map-ul ei, prin hash', async t => {
  const { origin } = await startTestApplication(t, { prefix: 'startica-csp-' });

  const page = await fetch(origin + '/');
  const html = await page.text();
  const importMap = html.match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(importMap, 'index.html nu conține import map-ul');
  assert.deepEqual(Object.keys(JSON.parse(importMap).imports), ['#app/', '#core/', '#shared/', '#features/']);
  const importMapHash = createHash('sha256').update(importMap).digest('base64');
  assert.ok(page.headers.get('content-security-policy').includes(`script-src 'self' 'sha256-${importMapHash}';`));

  const health = await fetch(origin + '/api/health');
  assert.ok(health.headers.get('content-security-policy').includes("script-src 'self';"));
});

test('Node rezolvă aliasurile # din package.json', () => {
  assert.equal(
    import.meta.resolve('#test-support/start-test-application.mjs'),
    new URL('./support/start-test-application.mjs', import.meta.url).href,
  );
});
