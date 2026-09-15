import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_EXPENSE_CATEGORIES, listExpenseCategoryNames } from './expense-category-names.mjs';

const emptyRecords = () => ({ children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] });

test('fără categorii sau cheltuieli proprii, întoarce doar sugestiile implicite, sortate ro', () => {
  const expected = [...DEFAULT_EXPENSE_CATEGORIES].sort((a, b) => a.localeCompare(b, 'ro'));
  assert.deepEqual(listExpenseCategoryNames(emptyRecords()), expected);
});

test('adaugă categoriile create de operator, fără duplicate față de sugestiile implicite', () => {
  const records = {
    ...emptyRecords(),
    categories: [
      { id: 'CAT-1', name: 'Excursii' },
      { id: 'CAT-2', name: 'Altele' },
    ],
  };
  const names = listExpenseCategoryNames(records);
  assert.ok(names.includes('Excursii'));
  assert.equal(names.filter(name => name === 'Altele').length, 1);
});

test('adaugă numele de categorie folosite deja de cheltuieli, deduplicate', () => {
  const records = {
    ...emptyRecords(),
    expenses: [
      { id: 'EXP-1', date: '2026-01-01', category: 'Transport', description: '', amount: 10 },
      { id: 'EXP-2', date: '2026-01-02', category: 'Transport', description: '', amount: 20 },
      { id: 'EXP-3', date: '2026-01-03', category: '', description: '', amount: 5 },
    ],
  };
  const names = listExpenseCategoryNames(records);
  assert.equal(names.filter(name => name === 'Transport').length, 1);
});

test('rezultatul este sortat cu localeCompare ro', () => {
  const records = {
    ...emptyRecords(),
    categories: [
      { id: 'CAT-1', name: 'Ăsta' },
      { id: 'CAT-2', name: 'Zebră' },
    ],
  };
  const names = listExpenseCategoryNames(records);
  const sorted = [...names].sort((a, b) => a.localeCompare(b, 'ro'));
  assert.deepEqual(names, sorted);
});
