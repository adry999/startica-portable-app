import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMoldovanPhone } from './phone-number.mjs';

test('fiecare formă acceptată devine E.164 +373 + 8 cifre', () => {
  for (const raw of ['+373 69123456', '373 69123456', '0 69123456', '069123456', '69123456', '0037369123456'])
    assert.equal(normalizeMoldovanPhone(raw), '+37369123456', raw);
});

test('spațiile, punctele, cratimele și parantezele sunt ignorate', () => {
  assert.equal(normalizeMoldovanPhone('(+373) 69-12.34 56'), '+37369123456');
});

test('prefixul mobil trebuie să fie unul din lista sms.md', () => {
  for (const prefix of ['60', '61', '62', '67', '68', '69', '76', '78', '79', '80'])
    assert.equal(normalizeMoldovanPhone(`0${prefix}123456`), `+373${prefix}123456`);
  assert.equal(normalizeMoldovanPhone('077123456'), null);
  assert.equal(normalizeMoldovanPhone('022123456'), null);
});

test('7 sau 9 cifre, numere străine, text gol sau non-șir → null', () => {
  assert.equal(normalizeMoldovanPhone('6912345'), null);
  assert.equal(normalizeMoldovanPhone('691234567'), null);
  assert.equal(normalizeMoldovanPhone('+40 721 000 000'), null);
  assert.equal(normalizeMoldovanPhone(''), null);
  assert.equal(normalizeMoldovanPhone('fără telefon'), null);
  assert.equal(normalizeMoldovanPhone(undefined), null);
});
