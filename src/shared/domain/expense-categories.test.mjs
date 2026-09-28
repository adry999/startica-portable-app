import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_EXPENSE_CATEGORY_SEEDS,
  GENERAL_CATEGORY_ID,
  GENERAL_CATEGORY_NAME,
  missingDefaultCategorySeeds,
  missingExpenseOnlyCategorySeeds,
} from './expense-categories.mjs';

const emptyRecords = () => ({ children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] });

test('missingDefaultCategorySeeds întoarce toate semințele implicite pe o filială nouă', () => {
  const seeds = missingDefaultCategorySeeds(emptyRecords());
  assert.deepEqual(seeds, DEFAULT_EXPENSE_CATEGORY_SEEDS);
  assert.ok(seeds.some(seed => seed.id === GENERAL_CATEGORY_ID && seed.name === GENERAL_CATEGORY_NAME));
});

test('missingDefaultCategorySeeds nu mai propune nimic după ce „General” a fost deja semănată', () => {
  const records = { ...emptyRecords(), categories: [{ id: GENERAL_CATEGORY_ID, name: GENERAL_CATEGORY_NAME }] };
  assert.deepEqual(missingDefaultCategorySeeds(records), []);
});

test('missingDefaultCategorySeeds nu recreează o categorie implicită ștearsă deliberat de operator, odată „General” prezentă', () => {
  const records = {
    ...emptyRecords(),
    categories: DEFAULT_EXPENSE_CATEGORY_SEEDS.filter(seed => seed.id !== 'CAT-chirie'),
  };
  assert.deepEqual(missingDefaultCategorySeeds(records), []);
});

test('missingDefaultCategorySeeds nu propune un nume deja folosit de o categorie a operatorului', () => {
  const records = { ...emptyRecords(), categories: [{ id: 'CAT-1', name: 'Salarii' }] };
  const seeds = missingDefaultCategorySeeds(records);
  assert.ok(!seeds.some(seed => seed.name === 'Salarii'));
  assert.equal(seeds.length, DEFAULT_EXPENSE_CATEGORY_SEEDS.length - 1);
});

test('missingExpenseOnlyCategorySeeds creează o categorie pentru un nume folosit doar de o cheltuială veche, fără înregistrare', () => {
  const records = {
    ...emptyRecords(),
    categories: DEFAULT_EXPENSE_CATEGORY_SEEDS,
    expenses: [{ id: 'EXP-1', date: '2026-01-01', category: 'Rechizite școlare', description: '', amount: 10 }],
  };
  const seeds = missingExpenseOnlyCategorySeeds(records, () => 'CAT-GENERATED');
  assert.deepEqual(seeds, [{ id: 'CAT-GENERATED', name: 'Rechizite școlare' }]);
});

test('missingExpenseOnlyCategorySeeds nu duplică un nume de cheltuială care se potrivește fără diacritice cu o categorie existentă', () => {
  const records = {
    ...emptyRecords(),
    categories: DEFAULT_EXPENSE_CATEGORY_SEEDS,
    expenses: [{ id: 'EXP-1', date: '2026-01-01', category: 'utilitati', description: '', amount: 10 }],
  };
  const seeds = missingExpenseOnlyCategorySeeds(records, () => 'CAT-GENERATED');
  assert.deepEqual(seeds, []);
});

test('missingExpenseOnlyCategorySeeds nu creează nimic dacă toate numele cheltuielilor au deja o categorie', () => {
  const records = {
    ...emptyRecords(),
    categories: DEFAULT_EXPENSE_CATEGORY_SEEDS,
    expenses: [{ id: 'EXP-1', date: '2026-01-01', category: 'Chirie', description: '', amount: 10 }],
  };
  assert.deepEqual(
    missingExpenseOnlyCategorySeeds(records, () => 'GENERATED-ID'),
    [],
  );
});
