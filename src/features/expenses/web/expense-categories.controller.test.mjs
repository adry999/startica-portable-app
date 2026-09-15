import test from 'node:test';
import assert from 'node:assert/strict';
import { createExpenseCategoriesController } from './expense-categories.controller.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */

/** @param {any} value */
const asAny = value => /** @type {any} */ (value);

/** @param {{ categories?: { id: string, name: string }[] }} [args] */
function createHarness({ categories = [] } = {}) {
  const notices = [];
  const submitted = [];
  /** @type {RecordsSnapshot} */
  const records = { categories, expenses: [], children: [], payments: [], groups: [] };
  const createForm = asAny({ reset: () => {} });
  const nameInput = asAny({ value: '', setAttribute: () => {} });
  createExpenseCategoriesController({
    elements: asAny({
      chips: { innerHTML: '', addEventListener: () => {} },
      createForm,
      nameInput,
      categoryFilter: { innerHTML: '', value: '' },
    }),
    readRecords: () => records,
    submitMutation: async (...args) => {
      submitted.push(args);
    },
    showNotice: (...args) => notices.push(args),
  });
  return { createForm, nameInput, notices, submitted };
}

const submit = createForm => createForm.onsubmit(asAny({ preventDefault: () => {} }));

test('adăugarea categoriei tastate fără diacritice reutilizează categoria existentă și nu trimite cererea', async () => {
  const { createForm, nameInput, notices, submitted } = createHarness({
    categories: [{ id: 'CAT-1', name: 'Bucătărie' }],
  });
  nameInput.value = ' bucatarie ';

  await submit(createForm);

  assert.deepEqual(notices, [['Categoria există deja.', true]]);
  assert.equal(submitted.length, 0);
});

test('adăugarea unei categorii noi trimite numele canonic și golește câmpul', async () => {
  const { createForm, nameInput, notices, submitted } = createHarness();
  nameInput.value = '  Rechizite  ';

  await submit(createForm);

  assert.equal(submitted.length, 1);
  assert.equal(submitted[0][1].record.name, 'Rechizite');
  assert.deepEqual(notices, [['Categorie adăugată.']]);
});

test('numele gol păstrează mesajul de azi și nu trimite cererea', async () => {
  const { createForm, nameInput, notices, submitted } = createHarness();
  nameInput.value = '   ';

  await submit(createForm);

  assert.deepEqual(notices, [['Completează numele categoriei.', true]]);
  assert.equal(submitted.length, 0);
});
