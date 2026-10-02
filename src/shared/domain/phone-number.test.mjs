import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMoldovanPhone, resolveStoredPhone } from './phone-number.mjs';

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

test('resolveStoredPhone: un mobil moldovenesc valid devine E.164', () => {
  assert.deepEqual(resolveStoredPhone('069123456'), { value: '+37369123456', invalid: false });
  assert.deepEqual(resolveStoredPhone('  0 69-12.34 56 '), { value: '+37369123456', invalid: false });
});

test('resolveStoredPhone: gol rămâne gol, fără marcaj invalid', () => {
  assert.deepEqual(resolveStoredPhone(''), { value: '', invalid: false });
  assert.deepEqual(resolveStoredPhone('   '), { value: '', invalid: false });
  assert.deepEqual(resolveStoredPhone(undefined), { value: '', invalid: false });
});

test('resolveStoredPhone: „alt număr" cu prefix + se salvează cum a fost scris, fără marcaj', () => {
  assert.deepEqual(resolveStoredPhone('+40 721 000 000'), { value: '+40 721 000 000', invalid: false });
  assert.deepEqual(resolveStoredPhone('+7 900 123 45 67'), { value: '+7 900 123 45 67', invalid: false });
});

test('resolveStoredPhone: orice altceva rămâne cum a fost scris, cu invalid: true', () => {
  assert.deepEqual(resolveStoredPhone('69123'), { value: '69123', invalid: true });
  assert.deepEqual(resolveStoredPhone('fără telefon'), { value: 'fără telefon', invalid: true });
  assert.deepEqual(resolveStoredPhone('022123456'), { value: '022123456', invalid: true });
});
