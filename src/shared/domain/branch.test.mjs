import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBranchInput, branchInitials, branchSlug, BRANCH_COLORS } from './branch.mjs';

test('normalizeBranchInput taie spațiile, refuză numele gol și culoarea necunoscută', () => {
  assert.deepEqual(normalizeBranchInput({ name: '  Botanica  ', color: 'mint', address: '  Str. Florilor  ' }), {
    name: 'Botanica',
    color: 'mint',
    address: 'Str. Florilor',
  });
  assert.deepEqual(normalizeBranchInput({ name: 'Buiucani' }), { name: 'Buiucani', color: 'orange', address: '' });
  assert.throws(() => normalizeBranchInput({ name: '   ' }), /obligatoriu/);
  assert.throws(() => normalizeBranchInput({ name: 'a'.repeat(41) }), /cel mult/);
  assert.throws(() => normalizeBranchInput({ name: 'Botanica', color: 'roz' }), /Culoare necunoscută/);
  for (const color of BRANCH_COLORS) assert.doesNotThrow(() => normalizeBranchInput({ name: 'Botanica', color }));
});

test('inițialele sunt primele două litere, prima mare', () => {
  assert.equal(branchInitials('Buiucani'), 'Bu');
  assert.equal(branchInitials('botanica'), 'Bo');
  assert.equal(branchInitials(''), '');
});

// F26 (PROMPT-11 §14.1): sare peste cifre, spații, puncte și prefixul „Filiala ”.
test('branchInitials sare peste cifre/prefix, nu ia prima cifră ca inițială', () => {
  assert.equal(branchInitials('1 Buiucani'), 'Bu');
  assert.equal(branchInitials('Filiala Centru'), 'Ce');
  assert.equal(branchInitials('2. Botanica'), 'Bo');
});

test('branchSlug scoate diacriticele și spațiile, cu maximum 30 de caractere', () => {
  assert.equal(branchSlug('Botanica'), 'botanica');
  assert.equal(branchSlug('Chișinău, sect. Botanica!'), 'chisinau-sect-botanica');
  assert.equal(branchSlug('A'.repeat(40)), 'a'.repeat(30));
});
