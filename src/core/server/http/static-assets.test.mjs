import test from 'node:test';
import assert from 'node:assert/strict';
import { isBrowserModule } from './static-assets.mjs';

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
