import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applySchema } from '#core/server/database/schema.mjs';
import { createRouteDispatcher } from '#core/server/http/route-dispatcher.mjs';
import { createRecordingAuditTrail } from '#test-support/recording-audit-trail.mjs';
import { startTestApplication } from '#test-support/start-test-application.mjs';
import { createSmsRoutes } from './sms.routes.mjs';
import { createSmsService } from './sms.service.mjs';
import { smsConfigFilePath } from './sms-config.repository.mjs';
import { DEFAULT_SMS_TEMPLATE_ID } from './sms-template.repository.mjs';
import { createFakeSmsApi, SMS_RESPONSES } from '../test-support/fake-sms-api.mjs';

const SESSION_TOKEN = 'test-token';
const VALID_TOKEN = 'tok-1234abcd';

/** @returns {import('node:net').AddressInfo} */
const listeningAddress = server => /** @type {import('node:net').AddressInfo} */ (server.address());

function startSmsServer(t, { fetch, auditTrail = createRecordingAuditTrail(), now } = {}) {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'startica-sms-'));
  t.after(() => rmSync(dataDirectory, { recursive: true, force: true }));
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  t.after(() => database.close());
  const smsService = createSmsService({ fetch });
  const routes = createSmsRoutes({
    database,
    dataDirectory,
    smsService,
    auditTrail,
    ...(now ? { now } : {}),
  });
  const dispatchRequest = createRouteDispatcher({
    root: process.cwd(),
    sessionToken: SESSION_TOKEN,
    routes,
  }).dispatchRequest;
  const server = createServer((request, response) => dispatchRequest(request, response, listeningAddress(server).port));
  t.after(() => new Promise(done => server.close(done)));
  return new Promise(resolveServer =>
    server.listen(0, '127.0.0.1', () =>
      resolveServer({
        server,
        database,
        dataDirectory,
        auditTrail,
        origin: `http://127.0.0.1:${listeningAddress(server).port}`,
      }),
    ),
  );
}

const getJson = (origin, path) => fetch(origin + path).then(response => response.json());
const postJson = async (origin, path, body = {}) => {
  const response = await fetch(origin + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Startica-Token': SESSION_TOKEN },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
};

test('conectarea cu token gol și fără configurare întoarce 400, fără niciun apel și fără fișier', async t => {
  const { fetch, calls } = createFakeSmsApi();
  const { origin, dataDirectory } = await startSmsServer(t, { fetch });
  const response = await postJson(origin, '/api/sms-connect', { token: '', sender: 'Startica', monthlyLimit: null });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /token/i);
  assert.equal(calls.length, 0);
  assert.equal(existsSync(smsConfigFilePath(dataDirectory)), false);
});

test('un token invalid (401 la balance) întoarce 400 și nu scrie fișier', async t => {
  const { fetch } = createFakeSmsApi({ balance: SMS_RESPONSES.unauthorized });
  const { origin, dataDirectory } = await startSmsServer(t, { fetch });
  const response = await postJson(origin, '/api/sms-connect', {
    token: VALID_TOKEN,
    sender: 'Startica',
    monthlyLimit: null,
  });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /Token sms\.md invalid/);
  assert.equal(existsSync(smsConfigFilePath(dataDirectory)), false);
});

test('un expeditor care nu e activ la sms.md întoarce 400 cu lista expeditorilor activi', async t => {
  const { fetch } = createFakeSmsApi({
    senders: {
      body: { status: 'success', httpCode: 200, data: [{ name: 'Altul', status: { id: 1, name: 'Active' } }] },
    },
  });
  const { origin } = await startSmsServer(t, { fetch });
  const response = await postJson(origin, '/api/sms-connect', {
    token: VALID_TOKEN,
    sender: 'Startica',
    monthlyLimit: null,
  });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /Expeditorul „Startica” nu e activ/);
  assert.match(response.body.error, /Altul/);
});

test('o conectare reușită scrie fișierul, auditează fără token și întoarce statusul mascat', async t => {
  const { fetch } = createFakeSmsApi();
  const { origin, dataDirectory, auditTrail } = await startSmsServer(t, { fetch });
  const response = await postJson(origin, '/api/sms-connect', {
    token: VALID_TOKEN,
    sender: 'Startica',
    monthlyLimit: null,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.status.configured, true);
  assert.equal(response.body.status.monthlyLimit, null);
  assert.ok(response.body.status.tokenMasked.startsWith('••••••••'));
  assert.ok(response.body.status.tokenMasked.endsWith(VALID_TOKEN.slice(-4)));
  assert.equal(existsSync(smsConfigFilePath(dataDirectory)), true);

  assert.equal(auditTrail.changes.length, 1);
  const [change] = auditTrail.changes;
  assert.equal(change.action, 'configurare sms');
  assert.deepEqual(change.before, { sender: '', monthlyLimit: null });
  assert.deepEqual(change.after, { sender: 'Startica', monthlyLimit: null });
  assert.equal(JSON.stringify(change).includes(VALID_TOKEN), false);
});

test('o reconectare cu token gol păstrează tokenul existent și actualizează limita', async t => {
  const { fetch } = createFakeSmsApi();
  const { origin, dataDirectory } = await startSmsServer(t, { fetch });
  await postJson(origin, '/api/sms-connect', { token: VALID_TOKEN, sender: 'Startica', monthlyLimit: null });

  const response = await postJson(origin, '/api/sms-connect', { token: '', sender: 'Startica', monthlyLimit: 300 });
  assert.equal(response.status, 200);
  assert.equal(response.body.status.monthlyLimit, 300);
  assert.ok(response.body.status.tokenMasked.endsWith(VALID_TOKEN.slice(-4)));
  const savedConfig = /** @type {any} */ (JSON.parse(readFileSync(smsConfigFilePath(dataDirectory), 'utf8')));
  assert.equal(savedConfig.token, VALID_TOKEN);
});

test('trimiterea fără conectare întoarce 400', async t => {
  const { fetch } = createFakeSmsApi();
  const { origin } = await startSmsServer(t, { fetch });
  const response = await postJson(origin, '/api/sms-send', {
    source: 'notify',
    month: '2026-09',
    templateId: null,
    messages: [{ childId: 'c1', childName: 'Ion', recipientName: 'Maria', phone: '+37369123456', text: 'Salut' }],
  });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /Conectează întâi sms\.md/);
});

test('trimiterea unui lot reușit scrie jurnalul și întoarce statusul cu sentThisMonth actualizat', async t => {
  const { fetch } = createFakeSmsApi();
  const { origin } = await startSmsServer(t, { fetch });
  await postJson(origin, '/api/sms-connect', { token: VALID_TOKEN, sender: 'Startica', monthlyLimit: null });

  const response = await postJson(origin, '/api/sms-send', {
    source: 'notify',
    month: '2026-09',
    templateId: null,
    messages: [
      { childId: 'c1', childName: 'Ion', recipientName: 'Maria', phone: '+37369123456', text: 'Salut' },
      { childId: 'c2', childName: 'Ana', recipientName: 'Elena', phone: '+37369123457', text: 'Salut' },
    ],
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.results.length, 2);
  assert.equal(response.body.status.sentThisMonth, 2);
});

test('sms-test scrie un rând de test și întoarce entry cu status sent', async t => {
  const { fetch } = createFakeSmsApi();
  const { origin } = await startSmsServer(t, { fetch });
  await postJson(origin, '/api/sms-connect', { token: VALID_TOKEN, sender: 'Startica', monthlyLimit: null });

  const response = await postJson(origin, '/api/sms-test', { phone: '069123456' });
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.entry.source, 'test');
  assert.equal(response.body.entry.status, 'sent');
});

test('last-notified conține copilul după un lot trimis', async t => {
  const { fetch } = createFakeSmsApi();
  const { origin } = await startSmsServer(t, { fetch });
  await postJson(origin, '/api/sms-connect', { token: VALID_TOKEN, sender: 'Startica', monthlyLimit: null });
  await postJson(origin, '/api/sms-send', {
    source: 'notify',
    month: '2026-09',
    templateId: null,
    messages: [{ childId: 'c1', childName: 'Ion', recipientName: 'Maria', phone: '+37369123456', text: 'Salut' }],
  });

  const lastNotified = await getJson(origin, '/api/sms-last-notified');
  assert.ok(lastNotified.c1);
  assert.equal(lastNotified.c1.month, '2026-09');
});

test('refresh-statuses actualizează un rând sent la delivered', async t => {
  const { fetch } = createFakeSmsApi();
  const { origin, database } = await startSmsServer(t, { fetch });
  await postJson(origin, '/api/sms-connect', { token: VALID_TOKEN, sender: 'Startica', monthlyLimit: null });
  await postJson(origin, '/api/sms-send', {
    source: 'notify',
    month: '2026-09',
    templateId: null,
    messages: [{ childId: 'c1', childName: 'Ion', recipientName: 'Maria', phone: '+37369123456', text: 'Salut' }],
  });

  const response = await postJson(origin, '/api/sms-refresh-statuses', {});
  assert.equal(response.status, 200);
  assert.equal(response.body.updated, 1);
  assert.equal(response.body.entries[0].status, 'delivered');
  void database;
});

test('template-save cu o variabilă necunoscută întoarce 400', async t => {
  const { fetch } = createFakeSmsApi();
  const { origin } = await startSmsServer(t, { fetch });
  const response = await postJson(origin, '/api/sms-template-save', {
    name: 'Test',
    body: 'Salut {necunoscut}',
    isDefault: false,
  });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /necunoscut/);
});

test('template-save fără stripDiacritics salvează cu implicit true', async t => {
  const { fetch } = createFakeSmsApi();
  const { origin } = await startSmsServer(t, { fetch });
  const response = await postJson(origin, '/api/sms-template-save', {
    name: 'Fără diacritice',
    body: 'Salut {copil}',
    isDefault: false,
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.template.stripDiacritics, true);
});

test('template-delete pe șablonul implicit întoarce 400', async t => {
  const { fetch } = createFakeSmsApi();
  const { origin } = await startSmsServer(t, { fetch });
  const response = await postJson(origin, '/api/sms-template-delete', { id: DEFAULT_SMS_TEMPLATE_ID });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /implicit nu se poate șterge/);
});

test('GET /api/sms-log cu after invalid întoarce 400', async t => {
  const { fetch: fakeFetch } = createFakeSmsApi();
  const { origin } = await startSmsServer(t, { fetch: fakeFetch });
  const response = await globalThis.fetch(origin + '/api/sms-log?after=nu-e-data');
  assert.equal(response.status, 400);
});

test('GET /api/sms-log implicit (fără after) întoarce lotul trimis, statisticile lunii și defalcarea pe luni', async t => {
  const { fetch } = createFakeSmsApi();
  const { origin } = await startSmsServer(t, { fetch, now: () => new Date('2026-09-27T12:00:00.000Z') });
  await postJson(origin, '/api/sms-connect', { token: VALID_TOKEN, sender: 'Startica', monthlyLimit: 500 });
  await postJson(origin, '/api/sms-send', {
    source: 'notify',
    month: '2026-09',
    templateId: null,
    messages: [{ childId: 'c1', childName: 'Ion', recipientName: 'Maria', phone: '+37369123456', text: 'Salut' }],
  });

  const page = await getJson(origin, '/api/sms-log');
  assert.equal(page.entries.length, 1);
  assert.equal(page.entries[0].childId, 'c1');
  assert.equal(page.stats.sentThisMonth, 1);
  assert.equal(page.stats.monthlyLimit, 500);
  assert.deepEqual(page.monthly, [{ month: '2026-09', sent: 1, segments: page.entries[0].segments, failed: 0 }]);
});

test('GET /api/sms-log?after= exclude rândurile de dinainte de cutoff', async t => {
  const { fetch } = createFakeSmsApi();
  const { origin } = await startSmsServer(t, { fetch, now: () => new Date('2026-09-27T12:00:00.000Z') });
  await postJson(origin, '/api/sms-connect', { token: VALID_TOKEN, sender: 'Startica', monthlyLimit: null });
  await postJson(origin, '/api/sms-send', {
    source: 'notify',
    month: '2026-09',
    templateId: null,
    messages: [{ childId: 'c1', childName: 'Ion', recipientName: 'Maria', phone: '+37369123456', text: 'Salut' }],
  });

  const page = await getJson(origin, '/api/sms-log?after=2026-09-28');
  assert.equal(page.entries.length, 0);
});

test('GET /api/sms-templates completează usageCountById după un lot trimis cu un șablon', async t => {
  const { fetch } = createFakeSmsApi();
  const { origin } = await startSmsServer(t, { fetch });
  await postJson(origin, '/api/sms-connect', { token: VALID_TOKEN, sender: 'Startica', monthlyLimit: null });
  await postJson(origin, '/api/sms-send', {
    source: 'notify',
    month: '2026-09',
    templateId: DEFAULT_SMS_TEMPLATE_ID,
    messages: [{ childId: 'c1', childName: 'Ion', recipientName: 'Maria', phone: '+37369123456', text: 'Salut' }],
  });

  const response = await getJson(origin, '/api/sms-templates');
  assert.equal(response.usageCountById[DEFAULT_SMS_TEMPLATE_ID], 1);
});

test('GET /api/sms-status neconfigurat nu face niciun apel de rețea, prin createApplication', async t => {
  const { get } = await startTestApplication(t, { fetch: createFakeSmsApi().fetch });
  const status = await get('/api/sms-status');
  assert.equal(status.configured, false);
});

test('app.expireSmsLog expiră rândurile mai vechi de 365 de zile', async t => {
  const { app } = await startTestApplication(t, { fetch: createFakeSmsApi().fetch });
  const result = app.expireSmsLog('2026-09-27');
  assert.deepEqual(result, { expired: 0 });
});
