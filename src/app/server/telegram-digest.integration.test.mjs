import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { startTestApplication } from '#test-support/start-test-application.mjs';
import { runTelegramDigest } from './telegram-digest.mjs';
import {
  writeTelegramConfig,
  removeTelegramConfig,
  readTelegramState,
} from '#features/telegram-notify/index.server.mjs';

// Testul dovedește concurența reală (nu doar unitară, ca în sqlite-connection.test.mjs):
// serverul rămâne pornit, cu baza deschisă la scriere, cât rulează procesul --telegram.

const TOKEN = '123456789:' + 'A'.repeat(25);

function fakeFetch(state) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
    if (state.mode === 'transient') throw new TypeError('fetch failed');
    if (state.mode === 'permanent')
      return { status: 401, json: async () => ({ ok: false, error_code: 401, description: 'Unauthorized' }) };
    return { status: 200, json: async () => ({ ok: true, result: {} }) };
  };
  return { fetchImpl, calls };
}

function fakeLog() {
  const entries = [];
  return { entries, write: (level, message) => entries.push({ level, message }) };
}

const importRequest = (state, revision) => ({ state, confirm: 'IMPORT', revision, requestId: randomUUID() });
const emptyImport = overrides => ({
  children: [],
  payments: [],
  expenses: [],
  groups: [],
  categories: [],
  visits: [],
  ...overrides,
});

test('runTelegramDigest citește instantaneul serverului pornit și trimite, retrimite și eșuează corect', async t => {
  const home = mkdtempSync(join(tmpdir(), 'startica-telegram-digest-'));
  const dataDir = join(home, 'Startica_Date');

  const child = {
    id: 'CH-ANA',
    name: 'Popescu Ana',
    parent: 'Popescu Ion',
    phone: '0722000000',
    status: 'Activ',
    birthDate: '2020-09-15',
    attendanceDate: '2026-01-10',
    dueDay: 5,
    statusHistory: [{ from: '2026-01', status: 'Activ' }],
    feeHistory: [{ from: '2026-01', amount: 500 }],
  };
  const visit = {
    id: 'VIZ-MARIA',
    name: 'Georgescu Maria',
    parent: 'Elena Georgescu',
    phone: '0722123456',
    date: '2026-09-15',
    time: '10:00',
    status: 'Programată',
    statusChangedAt: '2026-09-10T08:00:00.000Z',
  };

  const { get, post } = await startTestApplication(t, {
    prefix: 'startica-telegram-digest-app-',
    dataDir,
    backupDir: join(home, 'Startica_Backup'),
  });
  // Înregistrat după startTestApplication, ca să ruleze după închiderea aplicației
  // (hook-urile `after` rulează în ordinea înregistrării): altfel baza e încă
  // deschisă și ștergerea folderului `home` pică cu EBUSY.
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const imported = await post('/api/import', importRequest(emptyImport({ children: [child], visits: [visit] }), 0));
  assert.equal(imported.status, 200, imported.body.error);
  const revisionBefore = imported.body.revision;

  writeTelegramConfig(dataDir, { token: TOKEN, chatId: 555666777, chatName: 'Ion Popescu', botUsername: 'StaricaBot' });

  const telegram = fakeFetch({ mode: 'success' });
  const log1 = fakeLog();
  const exit1 = await runTelegramDigest({
    home,
    now: new Date('2026-09-15T08:00:00.000Z'),
    fetch: telegram.fetchImpl,
    log: log1,
  });

  assert.equal(exit1, 0);
  assert.equal(telegram.calls.length, 1, 'un singur apel: mesajul are sub 4096 de caractere');
  const sentText = telegram.calls[0].body.text;
  assert.match(sentText, /Popescu Ana/);
  assert.match(sentText, /Georgescu Maria/);

  const stateAfterFirstRun = readTelegramState(dataDir);
  assert.ok(Object.hasOwn(stateAfterFirstRun.sentKeys, 'zi:2026-09-15'));
  assert.ok(Object.hasOwn(stateAfterFirstRun.sentKeys, 'plata:CH-ANA:2026-09'));
  assert.equal(stateAfterFirstRun.lastError, '');
  assert.ok(log1.entries.some(entry => entry.level === 'INFO' && /^Trimis: \d+ chei$/.test(entry.message)));

  const exit2 = await runTelegramDigest({
    home,
    now: new Date('2026-09-15T18:00:00.000Z'),
    fetch: telegram.fetchImpl,
    log: fakeLog(),
  });
  assert.equal(exit2, 0);
  assert.equal(telegram.calls.length, 1, 'a doua rulare din aceeași zi nu mai cheamă Telegram');

  const transient = fakeFetch({ mode: 'transient' });
  const exit3 = await runTelegramDigest({
    home,
    now: new Date('2026-09-16T08:00:00.000Z'),
    fetch: transient.fetchImpl,
    log: fakeLog(),
  });
  assert.equal(exit3, 1, 'eșec tranzitoriu: ieșire 1, ca Task Scheduler să reia');
  assert.equal(transient.calls.length, 1);
  const stateAfterTransient = readTelegramState(dataDir);
  assert.equal(stateAfterTransient.lastError, 'Fără internet sau Telegram indisponibil.');
  assert.ok(!Object.hasOwn(stateAfterTransient.sentKeys, 'zi:2026-09-16'), 'niciun cheie nouă la eșec');

  const permanent = fakeFetch({ mode: 'permanent' });
  const exit4 = await runTelegramDigest({
    home,
    now: new Date('2026-09-17T08:00:00.000Z'),
    fetch: permanent.fetchImpl,
    log: fakeLog(),
  });
  assert.equal(exit4, 0, 'eșec permanent: ieșire 0, fără reluări');
  const stateAfterPermanent = readTelegramState(dataDir);
  assert.match(stateAfterPermanent.lastError, /Token invalid/);
  assert.ok(!Object.hasOwn(stateAfterPermanent.sentKeys, 'zi:2026-09-17'));

  removeTelegramConfig(dataDir);
  const noConfig = fakeFetch({ mode: 'success' });
  const exit5 = await runTelegramDigest({
    home,
    now: new Date('2026-09-18T08:00:00.000Z'),
    fetch: noConfig.fetchImpl,
    log: fakeLog(),
  });
  assert.equal(exit5, 0);
  assert.equal(noConfig.calls.length, 0, 'fără telegram.json: niciun apel de rețea');

  const stateAfterAll = await get('/api/state');
  assert.equal(stateAfterAll.revision, revisionBefore, 'baza serverului rămâne neschimbată după toate rulările');
});

test('cheia zilei se calculează din data locală, nu din UTC', async t => {
  const home = mkdtempSync(join(tmpdir(), 'startica-telegram-digest-tz-'));
  const dataDir = join(home, 'Startica_Date');

  const { post } = await startTestApplication(t, {
    prefix: 'startica-telegram-digest-tz-app-',
    dataDir,
    backupDir: join(home, 'Startica_Backup'),
  });
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const imported = await post('/api/import', importRequest(emptyImport(), 0));
  assert.equal(imported.status, 200, imported.body.error);

  writeTelegramConfig(dataDir, { token: TOKEN, chatId: 555666777, chatName: 'Ion Popescu', botUsername: 'StaricaBot' });

  const telegram = fakeFetch({ mode: 'success' });
  // Ora locală (constructor local, nu ISO UTC): la fusul mașinii curente, ora asta ar cădea
  // pe ziua anterioară dacă cheia s-ar calcula din toISOString().
  const exit = await runTelegramDigest({
    home,
    now: new Date(2026, 8, 18, 0, 30),
    fetch: telegram.fetchImpl,
    log: fakeLog(),
  });

  assert.equal(exit, 0);
  const state = readTelegramState(dataDir);
  assert.ok(Object.hasOwn(state.sentKeys, 'zi:2026-09-18'));
  assert.ok(!Object.hasOwn(state.sentKeys, 'zi:2026-09-17'));
});

test('o rulare ratată, reluată seara târziu, nu mai trimite rezumatul zilei', async t => {
  const home = mkdtempSync(join(tmpdir(), 'startica-telegram-digest-late-'));
  const dataDir = join(home, 'Startica_Date');

  const visit = {
    id: 'VIZ-MARIA',
    name: 'Georgescu Maria',
    parent: 'Elena Georgescu',
    phone: '0722123456',
    date: '2026-09-18',
    time: '10:00',
    status: 'Programată',
    statusChangedAt: '2026-09-10T08:00:00.000Z',
  };

  const { post } = await startTestApplication(t, {
    prefix: 'startica-telegram-digest-late-app-',
    dataDir,
    backupDir: join(home, 'Startica_Backup'),
  });
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const imported = await post('/api/import', importRequest(emptyImport({ visits: [visit] }), 0));
  assert.equal(imported.status, 200, imported.body.error);

  writeTelegramConfig(dataDir, { token: TOKEN, chatId: 555666777, chatName: 'Ion Popescu', botUsername: 'StaricaBot' });

  const telegram = fakeFetch({ mode: 'success' });
  const log = fakeLog();
  const exit = await runTelegramDigest({
    home,
    now: new Date(2026, 8, 18, 23, 0),
    fetch: telegram.fetchImpl,
    log,
  });

  assert.equal(exit, 0);
  assert.equal(telegram.calls.length, 0, 'nicio rulare ratată de seară nu mai trimite rezumatul de azi');
  const state = readTelegramState(dataDir);
  assert.ok(!Object.hasOwn(state.sentKeys, 'zi:2026-09-18'));
  assert.ok(log.entries.some(entry => entry.message === 'Rezumat ratat: prea târziu pentru azi'));
});
