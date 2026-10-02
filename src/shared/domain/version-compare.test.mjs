import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, isNewerVersion, parseSemver } from './version-compare.mjs';

test('parseSemver acceptă doar forma X.Y.Z', () => {
  assert.deepEqual(parseSemver('2.1.0'), { major: 2, minor: 1, patch: 0 });
  assert.deepEqual(parseSemver('10.20.30'), { major: 10, minor: 20, patch: 30 });
  assert.equal(parseSemver('2.1'), null);
  assert.equal(parseSemver('2.1.0-beta'), null);
  assert.equal(parseSemver('v2.1.0'), null);
  assert.equal(parseSemver(''), null);
  assert.equal(parseSemver(null), null);
  assert.equal(parseSemver(undefined), null);
  assert.equal(parseSemver(2.1), null);
});

test('compareVersions: versiuni egale', () => {
  assert.equal(compareVersions('2.1.0', '2.1.0'), 0);
});

test('compareVersions: prima mai veche decât a doua', () => {
  assert.equal(compareVersions('2.1.0', '2.2.0'), -1);
  assert.equal(compareVersions('2.1.0', '2.1.1'), -1);
  assert.equal(compareVersions('1.9.9', '2.0.0'), -1);
  assert.equal(compareVersions('2.9.0', '2.10.0'), -1, 'compară numeric, nu lexicografic');
});

test('compareVersions: prima mai nouă decât a doua', () => {
  assert.equal(compareVersions('2.2.0', '2.1.0'), 1);
  assert.equal(compareVersions('10.0.0', '9.9.9'), 1);
  assert.equal(compareVersions('2.1.10', '2.1.9'), 1, 'compară numeric, nu lexicografic');
});

test('compareVersions: o versiune malformată întoarce null, niciodată nu aruncă', () => {
  assert.equal(compareVersions('2.1', '2.2.0'), null);
  assert.equal(compareVersions('2.1.0', 'abc'), null);
  assert.equal(compareVersions('', ''), null);
  assert.doesNotThrow(() => compareVersions(/** @type {any} */ (undefined), /** @type {any} */ (null)));
});

test('isNewerVersion', () => {
  assert.equal(isNewerVersion('2.1.0', '2.2.0'), true);
  assert.equal(isNewerVersion('2.2.0', '2.1.0'), false);
  assert.equal(isNewerVersion('2.1.0', '2.1.0'), false);
  assert.equal(isNewerVersion('2.1.0', 'bad'), false, 'manifest invalid → niciodată actualizare raportată');
});
