import test from 'node:test';
import assert from 'node:assert/strict';
import { stripDiacritics, normalizeSearchText } from './text-search.mjs';

test('stripDiacritics elimină diacriticele românești', () => {
  assert.equal(stripDiacritics('ă â î ș ț'), 'a a i s t');
});

test('normalizeSearchText elimină diacriticele și normalizează majusculele', () => {
  assert.equal(normalizeSearchText('Ștefănescu'), 'stefanescu');
});

test('stripDiacritics și normalizeSearchText tratează null și undefined ca text gol', () => {
  assert.equal(stripDiacritics(null), '');
  assert.equal(stripDiacritics(undefined), '');
  assert.equal(normalizeSearchText(null), '');
  assert.equal(normalizeSearchText(undefined), '');
});
