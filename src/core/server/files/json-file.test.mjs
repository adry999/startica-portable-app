import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readJsonFile, writeJsonFileAtomically } from './json-file.mjs';

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'startica-json-file-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('citirea unui fișier lipsă întoarce null', t => {
  const file = join(tempDir(t), 'nu-exista.json');
  assert.equal(readJsonFile(file), null);
});

test('un fișier JSON corupt întoarce null și scrie o eroare în consolă', t => {
  const file = join(tempDir(t), 'corupt.json');
  writeFileSync(file, '{ nu e json');
  const logged = [];
  const originalError = console.error;
  console.error = message => logged.push(message);
  try {
    assert.equal(readJsonFile(file), null);
  } finally {
    console.error = originalError;
  }
  assert.equal(logged.length, 1);
});

test('scrierea și recitirea păstrează valoarea', t => {
  const file = join(tempDir(t), 'sub-folder', 'config.json');
  const value = { token: '123:abc', chatId: 42, sentKeys: { 'zi:2026-09-18': '2026-09-18' } };
  writeJsonFileAtomically(file, value);
  assert.deepEqual(readJsonFile(file), value);
});

test('scrierea atomică nu lasă niciun fișier .tmp', t => {
  const dir = tempDir(t);
  const file = join(dir, 'config.json');
  writeJsonFileAtomically(file, { chatId: 1 });
  assert.deepEqual(readdirSync(dir), ['config.json']);
});
