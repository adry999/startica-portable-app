import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoldovanPhone } from './phone-format.mjs';

test('formatMoldovanPhone grupează un E.164 moldovenesc ca „069 123 456"', () => {
  assert.equal(formatMoldovanPhone('+37369123456'), '069 123 456');
  assert.equal(formatMoldovanPhone('+37380123456'), '080 123 456');
});

test('formatMoldovanPhone păstrează prefixul unui număr străin, grupat din 3 în 3', () => {
  assert.equal(formatMoldovanPhone('+40721000000'), '+407 210 000 00');
  assert.equal(formatMoldovanPhone('+1234567'), '+123 456 7');
});

test('formatMoldovanPhone lasă neschimbat un text care nu e „+..."', () => {
  assert.equal(formatMoldovanPhone('069123'), '069123');
  assert.equal(formatMoldovanPhone(''), '');
});
