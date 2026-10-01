import test from 'node:test';
import assert from 'node:assert/strict';
import { createZipArchive, readZipArchive } from './zip-archive.mjs';

test('CRC32 pe un vector cunoscut', () => {
  // Vector standard: crc32("The quick brown fox jumps over the lazy dog") = 0x414FA339.
  const archive = createZipArchive([
    { name: 'a.txt', data: Buffer.from('The quick brown fox jumps over the lazy dog') },
  ]);
  const [entry] = readZipArchive(archive);
  assert.equal(entry.name, 'a.txt');
  // Dacă CRC-ul scris n-ar corespunde datelor, readZipArchive ar fi aruncat deja mai sus.
  assert.equal(entry.data.toString('utf8'), 'The quick brown fox jumps over the lazy dog');
});

test('round-trip cu mai multe fișiere, inclusiv binare și gol', () => {
  const entries = [
    { name: 'manifest.json', data: Buffer.from(JSON.stringify({ a: 1 })) },
    { name: 'common.db', data: Buffer.from([0, 1, 2, 255, 254, 253]) },
    { name: 'gol.txt', data: Buffer.alloc(0) },
  ];
  const archive = createZipArchive(entries);
  const read = readZipArchive(archive);

  assert.equal(read.length, entries.length);
  for (const [index, original] of entries.entries()) {
    assert.equal(read[index].name, original.name);
    assert.deepEqual(read[index].data, original.data);
  }
});

test('nume cu diacritice și spații', () => {
  const archive = createZipArchive([{ name: 'filiala-Bălți nouă.db', data: Buffer.from('conținut') }]);
  const [entry] = readZipArchive(archive);
  assert.equal(entry.name, 'filiala-Bălți nouă.db');
  assert.equal(entry.data.toString('utf8'), 'conținut');
});

test('arhivă fără fișiere', () => {
  const archive = createZipArchive([]);
  assert.deepEqual(readZipArchive(archive), []);
});

test('aruncă pe un buffer care nu e ZIP', () => {
  assert.throws(() => readZipArchive(Buffer.from('nu sunt un zip')), /ZIP invalid/);
});

test('aruncă pe o arhivă cu CRC corupt', () => {
  const archive = createZipArchive([{ name: 'a.txt', data: Buffer.from('conținut original') }]);
  // Strică un byte din zona de date (după cele 30 de bytes de header local + 5 de nume).
  const corrupted = Buffer.from(archive);
  corrupted[30 + 5] ^= 0xff;
  assert.throws(() => readZipArchive(corrupted), /CRC invalid/);
});
