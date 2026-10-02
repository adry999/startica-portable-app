import test from 'node:test';
import assert from 'node:assert/strict';
import { fail } from '#core/server/errors/domain-error.mjs';
import { createUndoRoutes } from './undo.routes.mjs';

// AUDIT-COD-02-10.md #5: /api/undo era în OPEN_PATHS fără nicio verificare proprie de modul —
// eligibilitatea (checkUndoEligibility, 15s/aceeași sesiune) nu garantează că profilul mai are
// acces ACUM la modulul intrării (poate fi restrâns de pe alt calculator chiar în acea fereastră).
// Test unitar (nu integration): dependențele reale (recordRepository/runRevisionTransaction)
// sunt mock-uite — ce se verifică aici e strict cablajul nou către assertModuleAccess/
// assertPinUnlocked, nu tranzacția de scriere în sine (acoperită deja de undo.routes.integration.test.mjs).

const SESSION_TOKEN = 'tok-1';
const OCCURRED_AT = new Date().toISOString();

// Implicit: tranzacția NU trebuie atinsă deloc — testele care verifică blocarea confirmă astfel
// că garda de modul a oprit anularea înainte de orice scriere reală. Testele care verifică
// cablajul (ce modul se calculează) dau `runRevisionTransaction` propriu, fără să mai treacă
// prin `applyChanges` (nu interesează tranzacția în sine aici, doar apelul la assertModuleAccess).
// Dependențe mock, nu reale — tipate `any` deliberat (JSDoc-ul `createUndoRoutes` cere forma
// completă a depozitelor reale, nestricto necesară pentru un test unitar al cablajului de gărzi).
/** @param {any} options */
function buildDependencies({
  assertModuleAccess,
  assertPinUnlocked = () => {},
  runRevisionTransaction = () => {
    throw new Error('nu trebuia chemat — garda de modul trebuia să oprească anularea mai devreme');
  },
}) {
  const entry = {
    id: 1,
    action: 'creare',
    recordType: 'payments',
    recordId: 'PAY-1',
    before: null,
    after: { id: 'PAY-1', amount: 500 },
    occurredAt: OCCURRED_AT,
    sessionToken: SESSION_TOKEN,
  };
  const recordRepository = { find: () => ({ id: 'PAY-1', amount: 500 }) };
  return /** @type {any} */ ({
    auditLogRepository: { findById: () => entry },
    recordRepository,
    runRevisionTransaction,
    sessionToken: SESSION_TOKEN,
    assertModuleAccess,
    assertPinUnlocked,
  });
}

function findUndoHandler(routes) {
  return routes.find(route => route.method === 'POST' && route.path === '/api/undo').handle;
}

test('undo() cheamă assertModuleAccess cu modulul intrării (KIND_MODULE[recordType]) înainte de orice scriere', () => {
  const calls = [];
  const routes = createUndoRoutes(
    buildDependencies({
      assertModuleAccess: (moduleId, options) => calls.push(['access', moduleId, options]),
      assertPinUnlocked: moduleId => calls.push(['pin', moduleId]),
      runRevisionTransaction: () => ({ ok: true }),
    }),
  );
  const undo = findUndoHandler(routes);

  undo({ body: { auditId: 1, requestId: 'req-1', revision: 0 } });

  assert.deepEqual(calls[0], ['access', 'payments', { write: true }]);
  assert.deepEqual(calls[1], ['pin', 'payments']);
});

test('un profil fără acces la modulul intrării respinge anularea, fără să atingă datele', () => {
  const routes = createUndoRoutes(
    buildDependencies({
      assertModuleAccess: () => fail('Acest calculator nu are acces la acest modul.', 403),
    }),
  );
  const undo = findUndoHandler(routes);

  assert.throws(() => undo({ body: { auditId: 1, requestId: 'req-1', revision: 0 } }), /nu are acces/);
});

test('un modul care cere PIN, dar neblocat, respinge anularea prin assertPinUnlocked', () => {
  const routes = createUndoRoutes(
    buildDependencies({
      assertModuleAccess: () => {},
      assertPinUnlocked: () => fail('PIN necesar.', 403),
    }),
  );
  const undo = findUndoHandler(routes);

  assert.throws(() => undo({ body: { auditId: 1, requestId: 'req-1', revision: 0 } }), /PIN necesar/);
});

test('un recordType fără intrare în KIND_MODULE (mapare uitată la un kind nou) cere implicit admin, nu rămâne nepăzit', () => {
  const calls = [];
  const dependencies = buildDependencies({
    assertModuleAccess: (moduleId, options) => calls.push(['access', moduleId, options]),
    runRevisionTransaction: () => ({ ok: true }),
  });
  dependencies.auditLogRepository = {
    findById: () => ({
      id: 2,
      action: 'creare',
      recordType: 'kind_nou_fara_mapare',
      recordId: 'X-1',
      before: null,
      after: { id: 'X-1' },
      occurredAt: OCCURRED_AT,
      sessionToken: SESSION_TOKEN,
    }),
  };
  dependencies.recordRepository.find = () => ({ id: 'X-1' });
  const routes = createUndoRoutes(dependencies);
  const undo = findUndoHandler(routes);

  undo({ body: { auditId: 2, requestId: 'req-2', revision: 0 } });

  assert.deepEqual(calls[0], ['access', 'admin', { write: true }]);
});
