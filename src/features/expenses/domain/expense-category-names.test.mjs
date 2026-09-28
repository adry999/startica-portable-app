import test from 'node:test';
import assert from 'node:assert/strict';
import { listExpenseCategoryNames } from './expense-category-names.mjs';

const emptyRecords = () => ({ children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] });

test('fără categorii sau cheltuieli, listExpenseCategoryNames întoarce o listă vidă', () => {
  assert.deepEqual(listExpenseCategoryNames(emptyRecords()), []);
});

test('listExpenseCategoryNames adaugă categoriile create de operator, fără duplicate', () => {
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

test('listExpenseCategoryNames adaugă numele de categorie folosite deja de cheltuieli, deduplicate', () => {
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

test('listExpenseCategoryNames e sortat cu localeCompare ro', () => {
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
