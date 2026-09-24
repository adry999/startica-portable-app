import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isStaticAsset, sendStaticAsset } from './static-assets.mjs';

// Rădăcină izolată, cu doar formă minimă a unui build Vite (webapp/dist) —
// nu depinde de un build real deja rulat, ca testul să rămână hermetic.
function fakeAppRoot() {
  const root = mkdtempSync(join(tmpdir(), 'startica-static-assets-'));
  const distRoot = join(root, 'webapp', 'dist');
  mkdirSync(join(distRoot, 'assets'), { recursive: true });
  writeFileSync(join(distRoot, 'index.html'), '<!doctype html><div id="root"></div>');
  writeFileSync(join(distRoot, 'assets', 'index-abc123.js'), 'console.log(1);');
  writeFileSync(join(distRoot, 'assets', 'index-abc123.css'), 'body{}');
  writeFileSync(join(distRoot, 'manifest.json'), '{}');
  // Canar în afara dist, exact unde ar ateriza o traversare reușită („..” din
  // dist duce în webapp/) — dacă paza cedează, testul de mai jos ar reuși să
  // îl citească, nu doar să nu-l găsească.
  writeFileSync(join(root, 'webapp', 'package.json'), '{"secret":"nu ar trebui servit"}');
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

// Simulează suprafața de ServerResponse folosită de sendStaticAsset/sendResponse.
function fakeResponse() {
  const headers = {};
  let body = null,
    status = null;
  return {
    writeHead: (s, h) => {
      status = s;
      Object.assign(headers, h);
    },
    end: content => {
      body = content;
    },
    get status() {
      return status;
    },
    get headers() {
      return headers;
    },
    get body() {
      return body;
    },
  };
}

test('un fișier existent din build e servit, cu tipul MIME corect', () => {
  const { root, cleanup } = fakeAppRoot();
  try {
    assert.equal(isStaticAsset(root, '/assets/index-abc123.js'), true);
    const response = fakeResponse();
    sendStaticAsset(response, root, '/assets/index-abc123.js');
    assert.equal(response.status, 200);
    assert.equal(response.headers['Content-Type'], 'text/javascript; charset=utf-8');
    assert.equal(response.body.toString('utf8'), 'console.log(1);');
  } finally {
    cleanup();
  }
});

test('rădăcina și orice cale fără extensie primesc index.html — SPA fără router propriu', () => {
  const { root, cleanup } = fakeAppRoot();
  try {
    for (const path of ['/', '/copii', '/de-notificat/oricine']) {
      assert.equal(isStaticAsset(root, path), true, path);
      const response = fakeResponse();
      sendStaticAsset(response, root, path);
      assert.equal(response.headers['Content-Type'], 'text/html; charset=utf-8', path);
      assert.match(response.body.toString('utf8'), /id="root"/, path);
    }
  } finally {
    cleanup();
  }
});

test('/manifest.json și /assets/*.css din build există și se servesc', () => {
  const { root, cleanup } = fakeAppRoot();
  try {
    assert.equal(isStaticAsset(root, '/manifest.json'), true);
    assert.equal(isStaticAsset(root, '/assets/index-abc123.css'), true);
  } finally {
    cleanup();
  }
});

test('o cale cu extensie care nu există în build primește 404, nu index.html', () => {
  const { root, cleanup } = fakeAppRoot();
  try {
    assert.equal(isStaticAsset(root, '/assets/lipsa.js'), false);
    assert.throws(() => sendStaticAsset(fakeResponse(), root, '/assets/lipsa.js'), /Pagina nu există/);
  } finally {
    cleanup();
  }
});

test('nicio traversare de directoare nu poate ieși din webapp/dist', () => {
  const { root, cleanup } = fakeAppRoot();
  try {
    // Doar căile cu extensie ajung la rezolvarea de fișier — orice cale fără
    // extensie primește sigur index.html (vezi testul de SPA fallback), deci
    // nu e un caz de traversare.
    const escapePaths = [
      '/../package.json',
      '/../../package.json',
      '/assets/../../package.json',
      '/%2e%2e/package.json',
      '/assets//../../package.json',
    ];
    for (const path of escapePaths) assert.equal(isStaticAsset(root, path), false, path);
  } finally {
    cleanup();
  }
});
