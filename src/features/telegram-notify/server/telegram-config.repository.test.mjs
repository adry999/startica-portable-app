import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readTelegramConfig,
  writeTelegramConfig,
  removeTelegramConfig,
  telegramConfigFilePath,
} from './telegram-config.repository.mjs';

function tempDataDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'startica-telegram-config-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('citirea configurării lipsă întoarce null', t => {
  const dataDir = tempDataDir(t);
  assert.equal(readTelegramConfig(dataDir), null);
});

test('un fișier JSON corupt întoarce null și scrie în consolă', t => {
  const dataDir = tempDataDir(t);
  writeFileSync(telegramConfigFilePath(dataDir), '{ nu e json');
  const logged = [];
  const originalError = console.error;
  console.error = message => logged.push(message);
  try {
    assert.equal(readTelegramConfig(dataDir), null);
  } finally {
    console.error = originalError;
  }
  assert.equal(logged.length, 1);
});

test('scrierea și recitirea configurării păstrează toate câmpurile', t => {
  const dataDir = tempDataDir(t);
  const config = { token: '123:abc', chatId: 42, chatName: 'Ana', botUsername: 'startica_bot' };
  writeTelegramConfig(dataDir, config);
  assert.deepEqual(readTelegramConfig(dataDir), config);
});

test('scrierea atomică nu lasă niciun fișier .tmp', t => {
  const dataDir = tempDataDir(t);
  writeTelegramConfig(dataDir, { token: '123:abc', chatId: 1, chatName: 'A', botUsername: 'b' });
  const files = readdirSync(dataDir);
  assert.deepEqual(files, ['telegram.json']);
});

test('ștergerea unei configurări existente elimină fișierul', t => {
  const dataDir = tempDataDir(t);
  writeTelegramConfig(dataDir, { token: '123:abc', chatId: 1, chatName: 'A', botUsername: 'b' });
  removeTelegramConfig(dataDir);
  assert.equal(readTelegramConfig(dataDir), null);
});

test('ștergerea unei configurări inexistente nu aruncă', t => {
  const dataDir = tempDataDir(t);
  assert.doesNotThrow(() => removeTelegramConfig(dataDir));
});
