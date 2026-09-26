import test from 'node:test';
import assert from 'node:assert/strict';
import { countSmsSegments } from './sms-segments.mjs';

const ascii = length => 'a'.repeat(length);

test('text GSM-7: 160 caractere = 1 segment, 161 = 2, 306 = 2, 307 = 3', () => {
  assert.deepEqual(countSmsSegments(ascii(160)), { characters: 160, segments: 1, encoding: 'gsm-7' });
  assert.equal(countSmsSegments(ascii(161)).segments, 2);
  assert.equal(countSmsSegments(ascii(306)).segments, 2);
  assert.equal(countSmsSegments(ascii(307)).segments, 3);
});

test('un singur „ă” comută tot mesajul pe UCS-2: 100 caractere devin 2 segmente', () => {
  const result = countSmsSegments('ă' + ascii(99));
  assert.equal(result.encoding, 'ucs-2');
  assert.equal(result.characters, 100);
  assert.equal(result.segments, 2);
});

test('UCS-2: 70 caractere = 1 segment, 71 = 2', () => {
  assert.equal(countSmsSegments('ș' + ascii(69)).segments, 1);
  assert.equal(countSmsSegments('ș' + ascii(70)).segments, 2);
});

test('caracterele din extensia GSM-7 (€ { } [ ] ~ \\ | ^) numără dublu, fără să comute pe UCS-2', () => {
  const result = countSmsSegments('€{}');
  assert.deepEqual(result, { characters: 6, segments: 1, encoding: 'gsm-7' });
  assert.equal(countSmsSegments(ascii(158) + '€').segments, 1);
  assert.equal(countSmsSegments(ascii(159) + '€').segments, 2);
});

test('textul gol are 0 segmente', () => {
  assert.deepEqual(countSmsSegments(''), { characters: 0, segments: 0, encoding: 'gsm-7' });
});
