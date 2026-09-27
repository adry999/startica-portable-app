import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_KINDERGARTEN_SETTINGS,
  clampKindergartenSettings,
  parseKindergartenSettings,
} from './kindergarten-settings.mjs';

test('clampKindergartenSettings completează cu implicite când nu primește nimic', () => {
  assert.deepEqual(clampKindergartenSettings(null), DEFAULT_KINDERGARTEN_SETTINGS);
  assert.deepEqual(clampKindergartenSettings(undefined), DEFAULT_KINDERGARTEN_SETTINGS);
  assert.deepEqual(clampKindergartenSettings({}), DEFAULT_KINDERGARTEN_SETTINGS);
});

test('clampKindergartenSettings păstrează câmpurile text valide și taie spațiile', () => {
  const settings = clampKindergartenSettings({ name: '  Grădinița Curcubeu  ', idno: '1234567890123' });
  assert.equal(settings.name, 'Grădinița Curcubeu');
  assert.equal(settings.idno, '1234567890123');
});

test('clampKindergartenSettings respinge un receiptFormat necunoscut', () => {
  assert.equal(clampKindergartenSettings(/** @type {any} */ ({ receiptFormat: 'a4-half' })).receiptFormat, 'a5');
  assert.equal(clampKindergartenSettings({ receiptFormat: 'a4-third' }).receiptFormat, 'a4-third');
});

test('clampKindergartenSettings acceptă nextReceiptNumber pozitiv, altfel revine la 1', () => {
  assert.equal(clampKindergartenSettings({ nextReceiptNumber: 42 }).nextReceiptNumber, 42);
  assert.equal(clampKindergartenSettings({ nextReceiptNumber: 0 }).nextReceiptNumber, 1);
  assert.equal(clampKindergartenSettings({ nextReceiptNumber: -5 }).nextReceiptNumber, 1);
  assert.equal(
    clampKindergartenSettings(/** @type {any} */ ({ nextReceiptNumber: 'zece' })).nextReceiptNumber,
    1,
  );
  assert.equal(clampKindergartenSettings({ nextReceiptNumber: 3.7 }).nextReceiptNumber, 4);
});

test('clampKindergartenSettings taie un text prea lung, ca settings să nu explodeze', () => {
  const long = 'x'.repeat(1000);
  assert.equal(clampKindergartenSettings({ name: long }).name, DEFAULT_KINDERGARTEN_SETTINGS.name);
});

test('parseKindergartenSettings pe JSON corupt revine la implicite, fără să arunce', () => {
  assert.deepEqual(parseKindergartenSettings('{nu e json'), DEFAULT_KINDERGARTEN_SETTINGS);
  assert.deepEqual(parseKindergartenSettings(''), DEFAULT_KINDERGARTEN_SETTINGS);
});

test('parseKindergartenSettings pe JSON parțial completează restul cu implicite', () => {
  const settings = parseKindergartenSettings(JSON.stringify({ name: 'Grădinița Soarele', nextReceiptNumber: 12 }));
  assert.equal(settings.name, 'Grădinița Soarele');
  assert.equal(settings.nextReceiptNumber, 12);
  assert.equal(settings.iban, DEFAULT_KINDERGARTEN_SETTINGS.iban);
});
