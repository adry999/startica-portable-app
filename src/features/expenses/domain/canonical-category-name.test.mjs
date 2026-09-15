import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalCategoryName } from './canonical-category-name.mjs';

test('canonicalCategoryName returnează categoria existentă care se potrivește fără diacritice și majuscule', () => {
  const records = { categories: [{ id: 'CAT-1', name: 'Bucătărie' }], expenses: [] };
  assert.equal(canonicalCategoryName('  bucatarie ', records), 'Bucătărie');
});

test('canonicalCategoryName recunoaște și categoriile folosite doar pe cheltuieli existente', () => {
  const records = { categories: [], expenses: [{ category: 'Rechizite școlare' }] };
  assert.equal(canonicalCategoryName('RECHIZITE SCOLARE', records), 'Rechizite școlare');
});

test('canonicalCategoryName păstrează valoarea tastată când nu există nicio potrivire', () => {
  const records = { categories: [], expenses: [] };
  assert.equal(canonicalCategoryName(' Altele noi ', records), 'Altele noi');
  assert.equal(canonicalCategoryName('', records), '');
});
