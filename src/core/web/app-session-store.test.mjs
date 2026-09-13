import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppSessionStore } from './app-session-store.mjs';
import { createDomainEventBus } from './domain-event-bus.mjs';
import { DomainEvent, DOMAIN_EVENT_NAMES } from '#shared/contracts/domain-events.mjs';

/** @param {(path: string, body?: unknown) => Promise<any>} requestJson */
function createHarness(requestJson) {
  const calls = [];
  const noticeMessages = [];
  const renderCalls = { records: 0, health: 0 };
  const publishedEvents = [];
  let requestIdCounter = 0;

  const eventBus = createDomainEventBus({ eventNames: DOMAIN_EVENT_NAMES, onListenerError: () => {} });
  eventBus.subscribe(DomainEvent.RecordsReloaded, payload => publishedEvents.push(payload));

  const store = createAppSessionStore({
    requestJson: async (path, body) => {
      calls.push({ path, body });
      return requestJson(path, body);
    },
    eventBus,
    renderRecords: () => renderCalls.records++,
    renderHealth: () => renderCalls.health++,
    showNotice: (text, isError = false) => noticeMessages.push({ text, isError }),
    renderSaveStatus: () => {},
    createRequestId: () => `REQUEST-ID-${++requestIdCounter}`,
  });

  return { store, calls, noticeMessages, renderCalls, publishedEvents };
}

const successfulState = { state: { children: [] }, revision: 7, updatedAt: '2026-09-13T10:00:00.000Z' };

test('load reușit pune starea, revizia, ready și ultima salvare, apoi randează și publică reîncărcarea', async () => {
  const { store, renderCalls, publishedEvents } = createHarness(async path => {
    if (path === '/api/session') return { token: 'TOKEN-1' };
    if (path === '/api/state') return successfulState;
    if (path === '/api/health') return { localOk: true };
    throw new Error(`cale neașteptată: ${path}`);
  });

  await store.load();

  assert.deepEqual(store.state.state, { children: [] });
  assert.equal(store.state.revision, 7);
  assert.equal(store.state.ready, true);
  assert.equal(store.state.lastSavedAt, '2026-09-13T10:00:00.000Z');
  assert.equal(store.state.token, 'TOKEN-1');
  assert.equal(renderCalls.records, 1);
  assert.equal(renderCalls.health, 1); // răspunsul de stare nu are health; load() randează sănătatea o singură dată
  assert.deepEqual(publishedEvents, [{ revision: 7 }]);
});

test('mutate înainte de încărcarea datelor aruncă', async () => {
  const { store } = createHarness(async () => ({}));
  await assert.rejects(() => store.mutate('/api/record', { name: 'Ana' }), {
    message: 'Așteaptă încărcarea datelor.',
  });
});

test('mutate trimite revizia curentă și un requestId generat', async () => {
  const { store, calls } = createHarness(async path => {
    if (path === '/api/session') return { token: 'TOKEN-1' };
    if (path === '/api/state') return successfulState;
    if (path === '/api/health') return {};
    if (path === '/api/record') return {};
    throw new Error(`cale neașteptată: ${path}`);
  });
  await store.load();

  await store.mutate('/api/record', { name: 'Ana' });

  const mutationCall = calls.find(call => call.path === '/api/record');
  assert.deepEqual(mutationCall.body, { name: 'Ana', revision: 7, requestId: 'REQUEST-ID-1' });
});

test('o cădere de rețea păstrează operațiunea pending, iar reluarea refolosește același requestId', async () => {
  let recordAttempts = 0;
  const { store, calls } = createHarness(async path => {
    if (path === '/api/session') return { token: 'TOKEN-1' };
    if (path === '/api/state') return successfulState;
    if (path === '/api/health') return {};
    if (path === '/api/record') {
      recordAttempts++;
      if (recordAttempts === 1) throw Object.assign(new Error('Conexiune întreruptă.'), { status: null });
      return {};
    }
    throw new Error(`cale neașteptată: ${path}`);
  });
  await store.load();

  await assert.rejects(() => store.mutate('/api/record', { name: 'Ana' }));
  assert.ok(store.state.pending, 'operațiunea rămâne pending după o cădere de rețea');

  await store.load();

  const recordCalls = calls.filter(call => call.path === '/api/record');
  assert.equal(recordCalls.length, 2);
  assert.equal(recordCalls[0].body.requestId, recordCalls[1].body.requestId);
  assert.equal(store.state.pending, null);
});

test('refuzul serverului golește operațiunea pending', async () => {
  const { store } = createHarness(async path => {
    if (path === '/api/session') return { token: 'TOKEN-1' };
    if (path === '/api/state') return successfulState;
    if (path === '/api/health') return {};
    if (path === '/api/record') throw Object.assign(new Error('Revizie învechită.'), { status: 409 });
    throw new Error(`cale neașteptată: ${path}`);
  });
  await store.load();

  await assert.rejects(() => store.mutate('/api/record', { name: 'Ana' }), { message: 'Revizie învechită.' });
  assert.equal(store.state.pending, null);
});

test('un refuz 403 reîmprospătează tokenul de sesiune', async () => {
  let recordAttempts = 0;
  const { store } = createHarness(async path => {
    if (path === '/api/session') return { token: recordAttempts === 0 ? 'TOKEN-1' : 'TOKEN-2' };
    if (path === '/api/state') return successfulState;
    if (path === '/api/health') return {};
    if (path === '/api/record') {
      recordAttempts++;
      throw Object.assign(new Error('Token expirat.'), { status: 403 });
    }
    throw new Error(`cale neașteptată: ${path}`);
  });
  await store.load();

  await assert.rejects(() => store.mutate('/api/record', { name: 'Ana' }));
  assert.equal(store.state.token, 'TOKEN-2');
  assert.equal(store.state.pending, null);
});

test('mutate refuză o nouă cerere cât timp una este pending sau busy', async () => {
  const { store } = createHarness(async path => {
    if (path === '/api/session') return { token: 'TOKEN-1' };
    if (path === '/api/state') return successfulState;
    if (path === '/api/health') return {};
    throw new Error(`cale neașteptată: ${path}`);
  });
  await store.load();

  store.state.pending = { path: '/api/record', body: {} };
  await assert.rejects(() => store.mutate('/api/record', { name: 'Ana' }), {
    message: 'Verifică operațiunea anterioară cu „Reîncarcă”.',
  });

  store.state.pending = null;
  store.state.busy = true;
  await assert.rejects(() => store.mutate('/api/record', { name: 'Ana' }), {
    message: 'Verifică operațiunea anterioară cu „Reîncarcă”.',
  });
});

test('checkConnection nu face nimic cât timp operațiunea e busy sau pending, altfel actualizează starea de sănătate', async () => {
  const { store, calls, renderCalls } = createHarness(async path => {
    if (path === '/api/session') return { token: 'TOKEN-1' };
    if (path === '/api/state') return successfulState;
    if (path === '/api/health') return { localOk: true };
    throw new Error(`cale neașteptată: ${path}`);
  });

  await store.checkConnection();
  assert.equal(calls.length, 0, 'nu verifică înainte de ready');

  await store.load();
  const callsAfterLoad = calls.length;

  store.state.busy = true;
  await store.checkConnection();
  assert.equal(calls.length, callsAfterLoad, 'nu verifică cât timp e busy');
  store.state.busy = false;

  store.state.pending = { path: '/api/record', body: {} };
  await store.checkConnection();
  assert.equal(calls.length, callsAfterLoad, 'nu verifică cât timp e pending');
  store.state.pending = null;

  await store.checkConnection();
  assert.equal(calls.length, callsAfterLoad + 1);
  assert.deepEqual(store.state.health, { localOk: true });
  assert.equal(renderCalls.health, 2); // load() + checkConnection()
});
