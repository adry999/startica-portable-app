import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, parseSemver } from './version-compare.mjs';

// Copie a src/shared/domain/version-compare.test.mjs, redusă la ce duplică version-compare.mjs
// (vezi comentariul de-acolo — sync-server/ nu importă din src/).

test('parseSemver acceptă doar forma X.Y.Z', () => {
  assert.deepEqual(parseSemver('2.1.0'), { major: 2, minor: 1, patch: 0 });
  assert.equal(parseSemver('2.1'), null);
  assert.equal(parseSemver('v2.1.0'), null);
  assert.equal(parseSemver(null), null);
});

test('compareVersions compară numeric, nu lexicografic, și nu aruncă pe o versiune malformată', () => {
  assert.equal(compareVersions('2.1.0', '2.1.0'), 0);
  assert.equal(compareVersions('2.1.0', '2.2.0'), -1);
  assert.equal(compareVersions('2.9.0', '2.10.0'), -1);
  assert.equal(compareVersions('2.2.0', '2.1.0'), 1);
  assert.equal(compareVersions('2.1', '2.2.0'), null);
  assert.doesNotThrow(() => compareVersions(/** @type {any} */ (undefined), /** @type {any} */ (null)));
});
