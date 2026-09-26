import test from 'node:test';
import assert from 'node:assert/strict';
import { stripDiacritics } from './strip-diacritics.mjs';

test('elimină diacriticele românești, inclusiv variantele cu sedilă', () => {
  assert.equal(
    stripDiacritics('Bună ziua, Ștefan! Ţară, şoaptă, împărat, mâine'),
    'Buna ziua, Stefan! Tara, soapta, imparat, maine',
  );
});

test('lasă neschimbat un text fără diacritice și textul gol', () => {
  assert.equal(stripDiacritics('Rest de plata: 200,00 lei'), 'Rest de plata: 200,00 lei');
  assert.equal(stripDiacritics(''), '');
});
