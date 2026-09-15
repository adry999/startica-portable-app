import test from 'node:test';
import assert from 'node:assert/strict';
import { sep } from 'node:path';
import { normalizeExternalFolder } from './external-backup-folder.mjs';

test('normalizeExternalFolder removes trailing backslash from absolute path', t => {
  const input = `G:\\Backup\\`;
  const result = normalizeExternalFolder(input);
  assert.equal(result, `G:\\Backup`);
});

test('normalizeExternalFolder converts forward slashes and removes trailing slash', t => {
  const input = `g:/backup/`;
  const result = normalizeExternalFolder(input);
  assert.equal(result, `g:\\backup`);
});

test('normalizeExternalFolder preserves bare drive root', t => {
  const input = `G:\\`;
  const result = normalizeExternalFolder(input);
  assert.equal(result, `G:\\`);
});

test('normalizeExternalFolder keeps relative path unchanged', t => {
  const input = `backups-relativ`;
  const result = normalizeExternalFolder(input);
  assert.equal(result, `backups-relativ`);
});

test('normalizeExternalFolder handles empty and null inputs', t => {
  assert.equal(normalizeExternalFolder(''), '');
  assert.equal(normalizeExternalFolder(null), '');
  assert.equal(normalizeExternalFolder(undefined), '');
});

test('normalizeExternalFolder trims whitespace but preserves internal spaces', t => {
  const input = `  G:\\My Folder\\  `;
  const result = normalizeExternalFolder(input);
  assert.equal(result, `G:\\My Folder`);
});
