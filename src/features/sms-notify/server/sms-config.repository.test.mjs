import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readSmsConfig,
  writeSmsConfig,
  removeSmsConfig,
  smsConfigFilePath,
  maskSmsToken,
} from './sms-config.repository.mjs';

function tempDataDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'startica-sms-config-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('citirea configurării lipsă întoarce null', t => {
  const dataDir = tempDataDir(t);
  assert.equal(readSmsConfig(dataDir), null);
});

test('un fișier JSON corupt întoarce null și scrie în consolă', t => {
  const dataDir = tempDataDir(t);
  writeFileSync(smsConfigFilePath(dataDir), '{ nu e json');
  const logged = [];
  const originalError = console.error;
  console.error = message => logged.push(message);
  try {
    assert.equal(readSmsConfig(dataDir), null);
  } finally {
    console.error = originalError;
  }
  assert.equal(logged.length, 1);
});

test('scrierea și recitirea configurării păstrează toate câmpurile, cu monthlyLimit null', t => {
  const dataDir = tempDataDir(t);
  const config = { token: 'tok-1234abcd', sender: 'Startica', monthlyLimit: null };
  writeSmsConfig(dataDir, config);
  assert.deepEqual(readSmsConfig(dataDir), config);
});

test('scrierea și recitirea configurării păstrează un monthlyLimit numeric', t => {
  const dataDir = tempDataDir(t);
  const config = { token: 'tok-1234abcd', sender: 'Startica', monthlyLimit: 500 };
  writeSmsConfig(dataDir, config);
  assert.deepEqual(readSmsConfig(dataDir), config);
});

test('scrierea atomică nu lasă niciun fișier .tmp', t => {
  const dataDir = tempDataDir(t);
  writeSmsConfig(dataDir, { token: 'tok-1234abcd', sender: 'Startica', monthlyLimit: null });
  const files = readdirSync(dataDir);
  assert.deepEqual(files, ['sms.json']);
});

test('ștergerea unei configurări existente elimină fișierul', t => {
  const dataDir = tempDataDir(t);
  writeSmsConfig(dataDir, { token: 'tok-1234abcd', sender: 'Startica', monthlyLimit: null });
  removeSmsConfig(dataDir);
  assert.equal(readSmsConfig(dataDir), null);
});

test('ștergerea unei configurări inexistente nu aruncă', t => {
  const dataDir = tempDataDir(t);
  assert.doesNotThrow(() => removeSmsConfig(dataDir));
});

test('maskSmsToken ascunde tokenul, păstrând ultimele 4 caractere', () => {
  assert.equal(maskSmsToken('tok-1234abcd'), '••••••••abcd');
  assert.equal(maskSmsToken(''), '');
});
