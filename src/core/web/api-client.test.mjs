import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from './api-client.mjs';

/** @param {unknown} error @returns {import('./api-error.mjs').ApiError} */
const asApiError = error => /** @type {import('./api-error.mjs').ApiError} */ (error);

/** @param {{ fetchResource?: import('./api-client.mjs').FetchResource }} [options] */
function createHarness({ fetchResource } = {}) {
  const connectionReports = [];
  const apiClient = createApiClient({
    readSessionToken: () => 'TOKEN-1',
    reportConnection: errorMessage => connectionReports.push(errorMessage),
    fetchResource,
  });
  return { apiClient, connectionReports };
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('o cerere GET nu trimite corp și folosește un timeout de 10 secunde', async () => {
  const calls = [];
  const originalTimeout = AbortSignal.timeout;
  const timeouts = [];
  AbortSignal.timeout = ms => {
    timeouts.push(ms);
    return originalTimeout(ms);
  };
  try {
    const { apiClient } = createHarness({
      fetchResource: async (path, options) => {
        calls.push({ path, options });
        return jsonResponse(200, { state: {} });
      },
    });
    await apiClient.requestJson('/api/state');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, '/api/state');
    assert.equal(calls[0].options.method, undefined);
    assert.equal(calls[0].options.headers, undefined);
    assert.equal(calls[0].options.body, undefined);
    assert.ok(calls[0].options.signal instanceof AbortSignal);
    assert.deepEqual(timeouts, [10000]);
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
});

test('o cerere POST trimite corpul, tokenul de sesiune și un timeout de 60 de secunde', async () => {
  const calls = [];
  const originalTimeout = AbortSignal.timeout;
  const timeouts = [];
  AbortSignal.timeout = ms => {
    timeouts.push(ms);
    return originalTimeout(ms);
  };
  try {
    const { apiClient } = createHarness({
      fetchResource: async (path, options) => {
        calls.push({ path, options });
        return jsonResponse(200, { ok: true });
      },
    });
    await apiClient.requestJson('/api/record', { name: 'Ana' });
    assert.equal(calls[0].options.method, 'POST');
    assert.deepEqual(calls[0].options.headers, {
      'Content-Type': 'application/json',
      'X-Startica-Token': 'TOKEN-1',
    });
    assert.equal(calls[0].options.body, JSON.stringify({ name: 'Ana' }));
    assert.deepEqual(timeouts, [60000]);
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
});

test('eșecul fetch devine o eroare de rețea și raportează reconectarea', async () => {
  const { apiClient, connectionReports } = createHarness({
    fetchResource: async () => {
      throw new Error('offline');
    },
  });

  await assert.rejects(
    () => apiClient.requestJson('/api/state'),
    error => {
      const apiError = asApiError(error);
      assert.equal(apiError.kind, 'network');
      assert.equal(apiError.status, null);
      assert.equal(apiError.message, 'Conexiune întreruptă. Apasă „Reîncarcă” pentru a verifica ultima operațiune.');
      return true;
    },
  );
  assert.deepEqual(connectionReports, ['Apasă „Reîncarcă” pentru a verifica ultima operațiune.']);
});

test('un corp expirat la parsare rămâne o cădere de rețea', async () => {
  const { apiClient, connectionReports } = createHarness({
    fetchResource: async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw Object.assign(new Error('expirat'), { name: 'TimeoutError' });
      },
    }),
  });

  await assert.rejects(() => apiClient.requestJson('/api/state'), { kind: 'network' });
  assert.deepEqual(connectionReports, ['Apasă „Reîncarcă” pentru a verifica ultima operațiune.']);
});

test('un corp care nu e JSON devine un răspuns neașteptat, cu statusul serverului', async () => {
  const { apiClient, connectionReports } = createHarness({
    fetchResource: async () => ({
      ok: true,
      status: 502,
      json: async () => {
        throw new SyntaxError('corp invalid');
      },
    }),
  });

  await assert.rejects(
    () => apiClient.requestJson('/api/state'),
    error => {
      const apiError = asApiError(error);
      assert.equal(apiError.kind, 'unexpected-response');
      assert.equal(apiError.status, 502);
      assert.equal(
        apiError.message,
        'Serverul a răspuns neașteptat (cod 502). Apasă „Reîncarcă” și verifică jurnalele.',
      );
      return true;
    },
  );
  assert.deepEqual(connectionReports, ['']);
});

test('un răspuns refuzat de server aruncă mesajul lui, cu statusul primit', async () => {
  const { apiClient, connectionReports } = createHarness({
    fetchResource: async () => jsonResponse(409, { error: 'Revizie învechită.' }),
  });

  await assert.rejects(
    () => apiClient.requestJson('/api/record', { id: 'X' }),
    error => {
      const apiError = asApiError(error);
      assert.equal(apiError.kind, 'rejected');
      assert.equal(apiError.status, 409);
      assert.equal(apiError.message, 'Revizie învechită.');
      return true;
    },
  );
  assert.deepEqual(connectionReports, ['']);
});

test('un răspuns refuzat fără mesaj folosește textul implicit', async () => {
  const { apiClient } = createHarness({
    fetchResource: async () => jsonResponse(500, {}),
  });

  await assert.rejects(() => apiClient.requestJson('/api/state'), { message: 'Operațiunea a eșuat.' });
});

test('un răspuns reușit raportează reconectarea și întoarce corpul primit', async () => {
  const { apiClient, connectionReports } = createHarness({
    fetchResource: async () => jsonResponse(200, { state: { children: [] }, revision: 3 }),
  });

  const result = await apiClient.requestJson('/api/state');

  assert.deepEqual(result, { state: { children: [] }, revision: 3 });
  assert.deepEqual(connectionReports, ['']);
});
