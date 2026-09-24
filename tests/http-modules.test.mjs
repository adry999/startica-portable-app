import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestApplication } from './support/start-test-application.mjs';

// Rădăcină izolată cu o formă minimă de build Vite (webapp/dist), plus un
// „canar” în afara lui dist — exact unde ar ateriza o traversare reușită —
// ca testul de mai jos să verifice prin HTTP real, nu doar unitar.
function createDistRoot(t) {
  const root = mkdtempSync(join(tmpdir(), 'startica-dist-root-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const distRoot = join(root, 'webapp', 'dist');
  mkdirSync(join(distRoot, 'assets'), { recursive: true });
  writeFileSync(join(distRoot, 'index.html'), '<!doctype html><div id="root"></div>');
  writeFileSync(join(distRoot, 'assets', 'index-abc123.js'), "console.log('probe');");
  writeFileSync(join(root, 'webapp', 'package.json'), '{"secret":"nu ar trebui servit"}');
  return root;
}

test('serverul livrează fișierele din webapp/dist, cade pe index.html pentru SPA și refuză traversarea/fișierele lipsă', async t => {
  const root = createDistRoot(t);
  const { origin } = await startTestApplication(t, { prefix: 'startica-http-modules-', root });

  const asset = await fetch(origin + '/assets/index-abc123.js');
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type'), /^text\/javascript/);
  assert.match(await asset.text(), /probe/);

  // Fără router propriu: orice cale fără extensie primește index.html, randat de React.
  const spaFallback = await fetch(origin + '/copii');
  assert.equal(spaFallback.status, 200);
  assert.match(await spaFallback.text(), /id="root"/);

  for (const path of ['/assets/../../package.json', '/assets/%2e%2e/%2e%2e/package.json', '/assets/missing.js']) {
    const refused = await fetch(origin + path);
    assert.equal(refused.status, 404, path);
    assert.doesNotMatch(await refused.text(), /secret/, path);
  }
});

test('pagina principală și API-ul au aceeași CSP, fără hash-uri de script inline', async t => {
  const { origin } = await startTestApplication(t, { prefix: 'startica-csp-' });

  const page = await fetch(origin + '/');
  const pageCsp = page.headers.get('content-security-policy');
  assert.ok(pageCsp.includes("script-src 'self';"), pageCsp);
  assert.doesNotMatch(pageCsp, /sha256-/, 'build-ul Vite nu are scripturi inline de permis');

  const health = await fetch(origin + '/api/health');
  assert.equal(health.headers.get('content-security-policy'), pageCsp);
});

test('Node rezolvă aliasurile # din package.json', () => {
  assert.equal(
    import.meta.resolve('#test-support/start-test-application.mjs'),
    new URL('./support/start-test-application.mjs', import.meta.url).href,
  );
});
