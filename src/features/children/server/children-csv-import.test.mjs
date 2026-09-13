import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseCsvRows, previewChildrenCsvImport } from './children-csv-import.mjs';

const csv =
  'ID (Nr. contract),Nume copil,Parinte,Telefon,Data nasterii,Data frecventarii,Parinte 2,Telefon 2\n1,Copil test,Parinte unu,060123456,01.01.2022,01.09.2026,Parinte doi,+37360123457';
const realChildrenCsv = new URL('../../../../../Fisiere_Excel/Lista_copiilor_inmatriculati.csv', import.meta.url);

test('CSV real: 105 copii, avertizări și reimport fără dubluri', t => {
  if (!existsSync(realChildrenCsv))
    return t.skip('Fisiere_Excel/Lista_copiilor_inmatriculati.csv lipsește pe acest calculator');
  const real = readFileSync(realChildrenCsv, 'utf8');
  const p = previewChildrenCsvImport(real);
  assert.deepEqual(p.errors, []);
  assert.equal(p.total, 105);
  assert.equal(p.additions.length, 105);
  assert.equal(p.additions.filter(c => !c.attendanceDate).length, 2);
  assert.equal(p.rows.filter(r => r.warnings.some(w => w.includes('Date neconcordante'))).length, 1);
  assert.ok(p.additions.every(c => c.fee === null && c.groupId === null && c.status === 'De verificat'));
  assert.ok(p.rows.some(r => r.warnings.some(w => w.includes('Părinte coincide'))));
  const repeated = previewChildrenCsvImport(real, p.additions);
  assert.equal(repeated.additions.length, 0);
  assert.equal(repeated.skipped, 105);
});

test('CSV: date sursă păstrate și conflicte la reimport', () => {
  const c = previewChildrenCsvImport(csv).additions[0];
  assert.equal(c.phone, '060123456');
  assert.equal(c.phone2, '+37360123457');
  assert.equal(c.parent2, 'Parinte doi');
  const snapshot = structuredClone(c),
    skip = previewChildrenCsvImport(csv, [{ ...c, phone: 'manual', archived: true }]);
  assert.equal(skip.skipped, 1);
  assert.equal(skip.additions.length, 0);
  assert.deepEqual(c, snapshot);
  assert.equal(previewChildrenCsvImport(csv, [{ ...c, name: 'Alt copil' }]).conflicts, 1);
  assert.equal(
    previewChildrenCsvImport(csv, [{ ...c, id: 'ID-alt', contractNumber: '2', birthDate: '2023-01-01' }]).conflicts,
    1,
  );
});

test('CSV: ghilimele, delimitatori, UTF-8 și validare strictă', () => {
  assert.deepEqual(parseCsvRows('\uFEFFa;b\n"unu;doi";"trei\npatru"')[1].cells, ['unu;doi', 'trei\npatru']);
  assert.deepEqual(parseCsvRows('a,b\n"a""b",c')[1].cells, ['a"b', 'c']);
  for (const invalid of ['a,b\n"neinchis', 'a,b\n"ok"oops,z', 'a,b\n\uFFFD,z'])
    assert.throws(() => parseCsvRows(invalid));
  for (const invalid of [
    csv + '\n' + csv.split('\n')[1],
    csv.replace('01.01.2022', '31.02.2022'),
    csv.replace('ID (Nr. contract)', 'necunoscut'),
    csv + '\n2,Lipsesc coloane',
  ])
    assert.ok(previewChildrenCsvImport(invalid).errors.length);
});
