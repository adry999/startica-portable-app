import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackupController } from './backup.controller.mjs';

/** @param {any} value */
const asAny = value => /** @type {any} */ (value);

// Un <select> real alege automat prima opțiune la randare; fake-ul reproduce
// asta din innerHTML, ca previewRestore() să primească un nume ne-gol.
function createBackupSelect() {
  let html = '';
  let value = '';
  return {
    get innerHTML() {
      return html;
    },
    set innerHTML(next) {
      html = next;
      value = next.match(/value="([^"]*)"/)?.[1] ?? '';
    },
    get value() {
      return value;
    },
    set value(next) {
      value = next;
    },
    onchange: null,
  };
}

function createRestoreSource(initial = 'local') {
  let current = initial;
  let onChange = null;
  return {
    setSelected: value => (current = value),
    addEventListener: (event, handler) => {
      if (event === 'change') onChange = handler;
    },
    fireChange: () => onChange?.(),
    querySelector: selector => {
      if (selector === 'input:checked') return { value: current };
      if (selector === 'input[value="local"]')
        return {
          set checked(v) {
            if (v) current = 'local';
          },
        };
      if (selector === 'input[value="extern"]')
        return {
          set checked(v) {
            if (v) current = 'extern';
          },
        };
      return null;
    },
  };
}

/** @param {{ health?: Record<string, unknown> }} [args] */
function createHarness({ health = {} } = {}) {
  const notices = [];
  const acceptedResults = [];
  const saveStatusCalls = [];
  let requestJsonImpl = /** @type {any} */ (
    () => {
      throw new Error('requestJson neconfigurat pentru acest test');
    }
  );
  let submitMutationImpl = /** @type {any} */ (
    () => {
      throw new Error('submitMutation neconfigurat pentru acest test');
    }
  );

  const sessionState = /** @type {any} */ ({
    revision: 1,
    health: { externalDir: '', ...health },
    pending: null,
    busy: false,
    settingsBusy: false,
    settingsError: '',
    settingsDirty: false,
  });

  const settingsSubmitButton = asAny({ disabled: false });
  const elements = {
    backupButton: asAny({ disabled: false, onclick: null }),
    restoreButton: asAny({ onclick: null }),
    restoreDialog: asAny({ showModal: () => {}, close: () => {} }),
    restoreSource: asAny(createRestoreSource()),
    restoreExternal: asAny({ hidden: true }),
    restoreFolder: asAny({ value: '' }),
    restoreFolderLoad: asAny({ onclick: null }),
    backupSelect: asAny(createBackupSelect()),
    restoreConfirm: asAny({ value: '' }),
    restorePreview: asAny({ innerHTML: '' }),
    commitRestore: asAny({ disabled: true, onclick: null }),
    settingsForm: asAny({ onsubmit: null, querySelector: () => settingsSubmitButton }),
    externalDirInput: asAny({ value: '', disabled: false }),
    diagnosticButton: asAny({ disabled: false, onclick: null }),
  };

  createBackupController({
    elements,
    sessionState,
    requestJson: (...args) => requestJsonImpl(...args),
    submitMutation: (...args) => submitMutationImpl(...args),
    acceptResult: result => acceptedResults.push(result),
    showNotice: (...args) => notices.push(args),
    renderSaveStatus: () => saveStatusCalls.push(true),
  });

  return {
    elements,
    sessionState,
    notices,
    acceptedResults,
    saveStatusCalls,
    settingsSubmitButton,
    setRequestJson: impl => (requestJsonImpl = impl),
    setSubmitMutation: impl => (submitMutationImpl = impl),
  };
}

test('un răspuns întârziat al /api/backup-preview, sosit după schimbarea selecției, este ignorat', async () => {
  const harness = createHarness();
  const { elements } = harness;
  const deferred = Promise.withResolvers();
  harness.setRequestJson(path => {
    if (path.startsWith('/api/backup-preview')) return deferred.promise;
    throw new Error('cerere neașteptată: ' + path);
  });
  elements.backupSelect.value = 'backup-veche.db';

  const pending = elements.backupSelect.onchange();
  elements.backupSelect.value = 'backup-noua.db';
  deferred.resolve({ children: 1, payments: 0, expenses: 0, paymentTotal: 0, expenseTotal: 0, notes: [], errors: [] });
  await pending;

  assert.equal(elements.commitRestore.disabled, true);
  assert.equal(elements.restorePreview.innerHTML, '');
});

test('loadExternalBackups adaugă notița de folder vechi și marchează prima opțiune ca „cea mai recentă”', async () => {
  const harness = createHarness();
  const { elements } = harness;
  elements.restoreSource.setSelected('extern');
  elements.restoreFolder.value = 'D:\\Backup';
  const oldModified = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  harness.setRequestJson(path => {
    if (path.startsWith('/api/external-backups'))
      return Promise.resolve({ backups: [{ name: 'externă.db', modified: oldModified }] });
    if (path.startsWith('/api/backup-preview'))
      return Promise.resolve({
        children: 0,
        payments: 0,
        expenses: 0,
        paymentTotal: 0,
        expenseTotal: 0,
        notes: [],
        errors: [],
      });
    throw new Error('cerere neașteptată: ' + path);
  });

  await elements.restoreFolderLoad.onclick();

  assert.match(elements.backupSelect.innerHTML, /cea mai recentă/);
  assert.match(elements.restorePreview.innerHTML, /verifică dacă Drive a terminat sincronizarea/);
});

test('commitRestore dintr-un folder extern adaugă sugestia de setare doar dacă folderul era gol înainte', async () => {
  const harness = createHarness({ health: { externalDir: '' } });
  const { elements } = harness;
  elements.restoreSource.setSelected('extern');
  elements.restoreFolder.value = 'D:\\Backup';
  elements.backupSelect.value = 'externă.db';
  harness.setRequestJson(path => {
    if (path.startsWith('/api/backup-preview'))
      return Promise.resolve({
        children: 0,
        payments: 0,
        expenses: 0,
        paymentTotal: 0,
        expenseTotal: 0,
        notes: [],
        errors: [],
      });
    throw new Error('cerere neașteptată: ' + path);
  });
  await elements.backupSelect.onchange();
  harness.setSubmitMutation(async () => ({ health: { ...harness.sessionState.health, externalDir: 'D:\\Backup' } }));

  await elements.commitRestore.onclick();

  assert.deepEqual(harness.notices.at(-1), [
    'Datele au fost restaurate din folderul extern. Folderul a fost setat pentru copiile viitoare.',
  ]);
});

test('commitRestore dintr-un folder extern nu adaugă sugestia dacă folderul era deja setat', async () => {
  const harness = createHarness({ health: { externalDir: 'D:\\Backup' } });
  const { elements } = harness;
  elements.restoreSource.setSelected('extern');
  elements.restoreFolder.value = 'D:\\Backup';
  elements.backupSelect.value = 'externă.db';
  harness.setRequestJson(path => {
    if (path.startsWith('/api/backup-preview'))
      return Promise.resolve({
        children: 0,
        payments: 0,
        expenses: 0,
        paymentTotal: 0,
        expenseTotal: 0,
        notes: [],
        errors: [],
      });
    throw new Error('cerere neașteptată: ' + path);
  });
  await elements.backupSelect.onchange();
  harness.setSubmitMutation(async () => ({ health: { ...harness.sessionState.health, externalDir: 'D:\\Backup' } }));

  await elements.commitRestore.onclick();

  assert.deepEqual(harness.notices.at(-1), ['Datele au fost restaurate din folderul extern.']);
});

test('settingsForm.onsubmit marchează settingsBusy cât durează cererea și reține eroarea la eșec', async () => {
  const harness = createHarness();
  const { elements, sessionState } = harness;
  const deferred = Promise.withResolvers();
  harness.setRequestJson(() => deferred.promise);

  const pending = elements.settingsForm.onsubmit({ preventDefault: () => {} });
  assert.equal(sessionState.settingsBusy, true);

  deferred.reject(new Error('Folder inaccesibil.'));
  await pending;

  assert.equal(sessionState.settingsBusy, false);
  assert.equal(sessionState.settingsError, 'Folder inaccesibil.');
  assert.deepEqual(harness.notices.at(-1), ['Folder inaccesibil.', true]);
});

test('settingsForm.onsubmit reușit apelează acceptResult', async () => {
  const harness = createHarness();
  const { elements } = harness;
  const result = { health: { ...harness.sessionState.health, externalDir: 'D:\\Backup' } };
  harness.setRequestJson(async () => result);

  await elements.settingsForm.onsubmit({ preventDefault: () => {} });

  assert.deepEqual(harness.acceptedResults, [result]);
  assert.equal(harness.sessionState.settingsBusy, false);
});

test('backupButton.onclick arată mesajul de succes doar când rezultatul nu are warning', async () => {
  const harness = createHarness();
  harness.setRequestJson(async () => ({ file: 'a', name: 'a', warning: '' }));

  await harness.elements.backupButton.onclick();

  assert.deepEqual(harness.notices, [['Backup local verificat creat.']]);
});

test('backupButton.onclick nu arată mesajul de succes când rezultatul are warning', async () => {
  const harness = createHarness();
  harness.setRequestJson(async () => ({ file: 'a', name: 'a', warning: 'Spațiu insuficient pe disc.' }));

  await harness.elements.backupButton.onclick();

  assert.deepEqual(harness.notices, []);
});
