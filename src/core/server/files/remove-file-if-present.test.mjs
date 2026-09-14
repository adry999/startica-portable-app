import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeFileIfPresent } from './remove-file-if-present.mjs';

function createTemporaryDirectory(t) {
  const directory = mkdtempSync(join(tmpdir(), 'startica-remove-file-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('șterge fișierul existent și ignoră unul lipsă', t => {
  const file = join(createTemporaryDirectory(t), 'copie.db.tmp');
  writeFileSync(file, 'conținut parțial');

  removeFileIfPresent(file);
  removeFileIfPresent(file);

  assert.equal(existsSync(file), false);
});

test('o ștergere eșuată lasă un avertisment, fără să arunce', t => {
  const directory = createTemporaryDirectory(t);
  const warn = t.mock.method(console, 'warn', () => {});

  removeFileIfPresent(directory);

  assert.equal(warn.mock.callCount(), 1);
  assert.match(String(warn.mock.calls[0].arguments[0]), /nu a putut fi șters/);
});
