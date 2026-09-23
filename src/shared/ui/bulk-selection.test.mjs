import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectAllCheckboxMarkup,
  rowCheckboxMarkup,
  bulkActionButtonLabel,
  bulkActionResultMessage,
  pickRecordsToToggle,
  buildArchiveMutationBody,
  createBulkSelectionController,
} from './bulk-selection.mjs';

// wireRowCheckboxes() caută caseta „selectează tot” prin document.getElementById; în Node,
// fără DOM, stub-ul întoarce null și acea ramură rămâne pur și simplu neexercitată.
globalThis.document ??= /** @type {any} */ ({ getElementById: () => null });

/** @param {any} value */
const asAny = value => /** @type {any} */ (value);

function fakeButton() {
  const classes = new Set();
  return asAny({
    hidden: false,
    disabled: false,
    textContent: '',
    dataset: {},
    classList: { contains: c => classes.has(c), add: c => classes.add(c), remove: c => classes.delete(c) },
  });
}

function fakeCheckbox(id, checked = false) {
  return asAny({ dataset: { id }, checked, onchange: null });
}

test('selectAllCheckboxMarkup include id-ul specific listei', () => {
  assert.equal(
    selectAllCheckboxMarkup('children'),
    '<input type="checkbox" id="childrenSelectAll" aria-label="Selectează tot ce se vede" title="Selectează tot ce se vede">',
  );
});

test('rowCheckboxMarkup marchează checked doar când rândul e selectat', () => {
  assert.equal(rowCheckboxMarkup('c1', false), '<input type="checkbox" class="row-select" data-id="c1">');
  assert.equal(rowCheckboxMarkup('c1', true), '<input type="checkbox" class="row-select" data-id="c1" checked>');
});

test('rowCheckboxMarkup pune eticheta accesibilă doar când e dată și o escapează', () => {
  assert.equal(
    rowCheckboxMarkup('c1', false, 'Selectează "Ana"'),
    '<input type="checkbox" class="row-select" data-id="c1" aria-label="Selectează &quot;Ana&quot;">',
  );
  assert.equal(rowCheckboxMarkup('c1', true, ''), '<input type="checkbox" class="row-select" data-id="c1" checked>');
});

test('bulkActionButtonLabel arată verbul potrivit vizualizării și numărul selectat', () => {
  assert.equal(bulkActionButtonLabel({ selectedCount: 0, isArchivedView: false }), 'Arhivează selectate');
  assert.equal(bulkActionButtonLabel({ selectedCount: 3, isArchivedView: false }), 'Arhivează selectate (3)');
  assert.equal(bulkActionButtonLabel({ selectedCount: 0, isArchivedView: true }), 'Dezarhivează selectate');
  assert.equal(bulkActionButtonLabel({ selectedCount: 2, isArchivedView: true }), 'Dezarhivează selectate (2)');
});

test('bulkActionResultMessage folosește numărul de id-uri selectate, nu al fișelor efectiv schimbate', () => {
  assert.equal(bulkActionResultMessage({ typeLabel: 'copii', count: 5, isArchivedView: false }), '5 copii arhivate.');
  assert.equal(
    bulkActionResultMessage({ typeLabel: 'achitări', count: 1, isArchivedView: true }),
    '1 achitări dezarhivate.',
  );
});

test('pickRecordsToToggle sare peste id-uri lipsă și peste fișe deja în starea țintă', () => {
  const records = [
    { id: 'a', archived: false },
    { id: 'b', archived: true },
    { id: 'c', archived: false },
  ];
  assert.deepEqual(pickRecordsToToggle(['a', 'b', 'missing'], records, true), [{ id: 'a', archived: false }]);
  assert.deepEqual(pickRecordsToToggle(['b', 'c'], records, false), [{ id: 'b', archived: true }]);
});

test('butonul de acțiune în masă e ascuns cât timp nu e nimic selectat, și apare la prima bifare', () => {
  const bulkButton = fakeButton();
  const checkbox = fakeCheckbox('a');
  const table = asAny({ querySelectorAll: selector => (selector === '.row-select' ? [checkbox] : []) });
  const controller = createBulkSelectionController({
    recordType: 'children',
    typeLabel: 'copii',
    elements: { table, selectAllId: 'childrenSelectAll', bulkButton },
    readRecords: () => [],
    submitMutation: async () => ({}),
    showNotice: () => {},
  });

  controller.wireRowCheckboxes();
  assert.equal(bulkButton.hidden, true);

  checkbox.checked = true;
  checkbox.onchange();
  assert.equal(bulkButton.hidden, false);

  checkbox.checked = false;
  checkbox.onchange();
  assert.equal(bulkButton.hidden, true);
});

test('buildArchiveMutationBody pune archivedAt doar când se arhivează', () => {
  const record = { id: 'x', archived: false, name: 'Test' };
  assert.deepEqual(buildArchiveMutationBody('children', record, true, '2026-09-13T00:00:00.000Z'), {
    type: 'children',
    mode: 'update',
    record: { id: 'x', archived: true, archivedAt: '2026-09-13T00:00:00.000Z', name: 'Test' },
  });
  assert.deepEqual(buildArchiveMutationBody('children', record, false, '2026-09-13T00:00:00.000Z'), {
    type: 'children',
    mode: 'update',
    record: { id: 'x', archived: false, archivedAt: null, name: 'Test' },
  });
});
