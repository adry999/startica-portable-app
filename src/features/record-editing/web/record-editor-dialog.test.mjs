import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecordEditorDialog } from './record-editor-dialog.mjs';

/** @param {any} value */
const asAny = value => /** @type {any} */ (value);

// FormData reală nu acceptă un formular fals; polyfill minimal care citește
// perechile [name, value] puse pe event.currentTarget.entries în teste.
class FakeFormData {
  #entries;
  constructor(form) {
    this.#entries = asAny(form).entries ?? [];
  }
  [Symbol.iterator]() {
    return this.#entries[Symbol.iterator]();
  }
}

let originalFormData;
before(() => {
  originalFormData = globalThis.FormData;
  globalThis.FormData = asAny(FakeFormData);
});
after(() => {
  globalThis.FormData = originalFormData;
});

/**
 * @param {{ read?: (formData: any) => any, markup?: (record: any, context: any) => string,
 *   title?: (record: any, mode: string) => string, bind?: (form: any, context: any) => void }} [args]
 */
function createFields({
  read = formData => ({ ...formData }),
  markup = () => '<div></div>',
  title = () => 'Titlu',
  bind,
} = {}) {
  return { idPrefix: 'ID', title, markup, bind, read };
}

/**
 * @param {{ records?: any, fieldsByType?: any, sessionStateOverrides?: Record<string, unknown> }} [args]
 */
function createHarness({
  records = { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] },
  fieldsByType = { children: createFields() },
  sessionStateOverrides = {},
} = {}) {
  const notices = [];
  const submittedCalls = [];
  const showModalCalls = [];
  const closeCalls = [];
  const sessionState = asAny({
    ready: true,
    pending: null,
    busy: false,
    revision: 5,
    editor: null,
    editorDirty: false,
    saveError: '',
    ...sessionStateOverrides,
  });
  const elements = {
    editor: asAny({ showModal: () => showModalCalls.push(true), close: () => closeCalls.push(true) }),
    editorForm: asAny({ onsubmit: null }),
    editorTitle: asAny({ textContent: '' }),
    editorFields: asAny({ innerHTML: '' }),
    editorError: asAny({ textContent: '' }),
    editorSave: asAny({ disabled: false }),
  };

  const controller = createRecordEditorDialog({
    elements,
    fieldsByType: asAny(fieldsByType),
    sessionState,
    readRecords: () => records,
    submitMutation: async (path, body, revision) => {
      submittedCalls.push([path, body, revision]);
      return {};
    },
    showNotice: (...args) => notices.push(args),
    renderSaveStatus: () => {},
  });

  return { controller, elements, sessionState, notices, submittedCalls, showModalCalls, closeCalls, records };
}

test('openEditor refuză cu notificare de eroare cât timp sessionState.ready e fals', () => {
  const { controller, notices, showModalCalls } = createHarness({ sessionStateOverrides: { ready: false } });

  controller.openEditor('children', 'X-1');

  assert.deepEqual(notices, [['Reîncarcă datele înainte de a deschide un formular.', true]]);
  assert.equal(showModalCalls.length, 0);
});

test('openEditor refuză cu notificare de eroare cât timp sessionState.pending e setat', () => {
  const { controller, notices, showModalCalls } = createHarness({
    sessionStateOverrides: { pending: { requestId: 'req-1' } },
  });

  controller.openEditor('children', 'X-1');

  assert.deepEqual(notices, [['Reîncarcă datele înainte de a deschide un formular.', true]]);
  assert.equal(showModalCalls.length, 0);
});

test('openEditor(type, undefined, { prefill }) pornește fișa nouă din prefill; cu id existent, prefill e ignorat', () => {
  const records = {
    children: [{ id: 'EXIST-1', name: 'Deja există' }],
    payments: [],
    expenses: [],
    groups: [],
    categories: [],
    visits: [],
  };
  /** @type {any} */
  let capturedRecord;
  const fields = createFields({
    markup: record => {
      capturedRecord = record;
      return '<div></div>';
    },
  });
  const { controller } = createHarness({ records, fieldsByType: { children: fields } });

  controller.openEditor('children', undefined, { prefill: { name: 'Copil nou', parent: 'Maria' } });
  assert.equal(capturedRecord.name, 'Copil nou');
  assert.equal(capturedRecord.parent, 'Maria');

  controller.openEditor('children', 'EXIST-1', { prefill: { name: 'Ar trebui ignorat' } });
  assert.equal(capturedRecord.name, 'Deja există');
  assert.equal(capturedRecord.parent, undefined);
});

test('revizia trimisă la salvare e cea din momentul deschiderii, chiar dacă sessionState.revision s-a schimbat între timp', async () => {
  const records = {
    children: [{ id: 'C-1', name: 'Ana' }],
    payments: [],
    expenses: [],
    groups: [],
    categories: [],
    visits: [],
  };
  const fields = createFields({ read: formData => ({ id: 'C-1', name: formData.name }) });
  const { controller, elements, sessionState, submittedCalls } = createHarness({
    records,
    fieldsByType: { children: fields },
  });

  controller.openEditor('children', 'C-1');
  sessionState.revision = 42;

  await elements.editorForm.onsubmit({ preventDefault: () => {}, currentTarget: { entries: [['name', 'Ana Pop']] } });

  assert.equal(submittedCalls.length, 1);
  assert.equal(submittedCalls[0][2], 5);
});

test('options.submit înlocuiește POST-ul implicit către /api/record', async () => {
  const records = { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] };
  const fields = createFields({ read: formData => ({ id: 'NEW-1', name: formData.name }) });
  const customSubmitCalls = [];
  const customSubmit = async record => {
    customSubmitCalls.push(record);
  };
  const { controller, elements, submittedCalls } = createHarness({ records, fieldsByType: { children: fields } });

  controller.openEditor('children', undefined, { submit: customSubmit });
  await elements.editorForm.onsubmit({ preventDefault: () => {}, currentTarget: { entries: [['name', 'Ana']] } });

  assert.deepEqual(
    customSubmitCalls.map(record => record.name),
    ['Ana'],
  );
  assert.equal(submittedCalls.length, 0);
});

test('read() care întoarce null oprește salvarea fără să trimită cererea', async () => {
  const records = {
    children: [{ id: 'C-1', name: 'Ana' }],
    payments: [],
    expenses: [],
    groups: [],
    categories: [],
    visits: [],
  };
  const fields = createFields({ read: () => null });
  const { controller, elements, submittedCalls, closeCalls } = createHarness({
    records,
    fieldsByType: { children: fields },
  });

  controller.openEditor('children', 'C-1');
  await elements.editorForm.onsubmit({ preventDefault: () => {}, currentTarget: { entries: [] } });

  assert.equal(submittedCalls.length, 0);
  assert.equal(closeCalls.length, 0);
});

test('archiveRecord comută archived și archivedAt', async () => {
  const records = {
    children: [{ id: 'C-1', name: 'Ana', archived: false, archivedAt: '' }],
    payments: [],
    expenses: [],
    groups: [],
    categories: [],
    visits: [],
  };
  const { controller, submittedCalls } = createHarness({ records });

  await controller.archiveRecord('children', 'C-1');

  assert.equal(submittedCalls[0][0], '/api/record');
  assert.equal(submittedCalls[0][1].record.archived, true);
  assert.notEqual(submittedCalls[0][1].record.archivedAt, '');

  records.children[0] = submittedCalls[0][1].record;
  await controller.archiveRecord('children', 'C-1');

  assert.equal(submittedCalls[1][1].record.archived, false);
  assert.equal(submittedCalls[1][1].record.archivedAt, '');
});
