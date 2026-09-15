import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readTelegramState,
  writeTelegramState,
  removeTelegramState,
  telegramStateFilePath,
} from './telegram-state.repository.mjs';

function tempDataDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'startica-telegram-state-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const EMPTY_STATE = { lastRun: '', lastSuccess: '', lastError: '', sentKeys: {} };

test('citirea stării lipsă întoarce starea implicită', t => {
  const dataDir = tempDataDir(t);
  assert.deepEqual(readTelegramState(dataDir), EMPTY_STATE);
});

test('un fișier de stare corupt întoarce starea implicită și scrie în consolă', t => {
  const dataDir = tempDataDir(t);
  writeFileSync(telegramStateFilePath(dataDir), 'nu e json{{{');
  const logged = [];
  const originalError = console.error;
  console.error = message => logged.push(message);
  try {
    assert.deepEqual(readTelegramState(dataDir), EMPTY_STATE);
  } finally {
    console.error = originalError;
  }
  assert.equal(logged.length, 1);
});

test('scrierea și recitirea stării păstrează toate câmpurile', t => {
  const dataDir = tempDataDir(t);
  const state = {
    lastRun: '2026-09-15T08:00:00.000Z',
    lastSuccess: '2026-09-15T08:00:00.000Z',
    lastError: '',
    sentKeys: { 'zi:2026-09-15': '2026-09-15' },
  };
  writeTelegramState(dataDir, state);
  assert.deepEqual(readTelegramState(dataDir), state);
});

test('scrierea atomică nu lasă niciun fișier .tmp', t => {
  const dataDir = tempDataDir(t);
  writeTelegramState(dataDir, EMPTY_STATE);
  assert.deepEqual(readdirSync(dataDir), ['telegram-stare.json']);
});

test('ștergerea unei stări existente elimină fișierul', t => {
  const dataDir = tempDataDir(t);
  writeTelegramState(dataDir, EMPTY_STATE);
  removeTelegramState(dataDir);
  assert.deepEqual(readTelegramState(dataDir), EMPTY_STATE);
  assert.deepEqual(readdirSync(dataDir), []);
});

test('ștergerea unei stări inexistente nu aruncă', t => {
  const dataDir = tempDataDir(t);
  assert.doesNotThrow(() => removeTelegramState(dataDir));
});
