import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBrowserModule, isStaticAsset, STATIC_FILES } from './static-assets.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

const BROWSER_MODULES = [
  '/src/app/web/main.mjs',
  '/src/core/web/api-client.mjs',
  '/src/shared/format/money-format.mjs',
  '/src/shared/ui/child-picker.mjs',
  '/src/features/audit-log/index.web.mjs',
  '/src/features/audit-log/web/audit-log.controller.mjs',
  '/src/features/audit-log/domain/audit-change-diff.mjs',
];

const PRIVATE_PATHS = [
  '/ui/views.mjs',
  '/shared/domain.mjs',
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

test('lista albă acceptă doar modulele de browser', () => {
  for (const path of BROWSER_MODULES) assert.equal(isBrowserModule(path), true, path);
  for (const path of PRIVATE_PATHS) assert.equal(isBrowserModule(path), false, path);
});

test('pictograma ICO e în lista albă și fișierul mapat există', () => {
  assert.equal(isStaticAsset('/assets/startica.ico'), true);
  assert.equal(existsSync(join(ROOT, STATIC_FILES['/assets/startica.ico'])), true);
});

test('manifestul web și pictogramele PNG sunt în lista albă și fișierele mapate există', () => {
  const paths = ['/manifest.json', '/assets/startica-192.png', '/assets/startica-512.png'];
  for (const path of paths) {
    assert.equal(isStaticAsset(path), true, path);
    assert.equal(existsSync(join(ROOT, STATIC_FILES[path])), true, path);
  }
});

test('fiecare foaie de stil din index.html e în lista albă și fișierul mapat există', () => {
  const html = readFileSync(join(ROOT, 'web/index.html'), 'utf8');
  const stylesheetHrefs = [...html.matchAll(/<link\s+[^>]*>/g)]
    .map(match => match[0])
    .filter(tag => /rel="stylesheet"/.test(tag))
    .map(tag => /href="([^"]+)"/.exec(tag)?.[1]);
  assert.ok(stylesheetHrefs.length > 0);
  for (const href of stylesheetHrefs) {
    assert.equal(isStaticAsset(href), true, href);
    assert.equal(existsSync(join(ROOT, STATIC_FILES[href])), true, href);
  }
});
