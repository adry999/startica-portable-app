import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVisitPasteTemplate } from './visit-paste-template.mjs';

const groups = [
  { id: 'GRP-1', name: 'Fluturași' },
  { id: 'GRP-2', name: 'Albinuțe' },
];

test('parseVisitPasteTemplate completează toate câmpurile dintr-un șablon plin', () => {
  const text = [
    'Copil: Ana Popescu',
    'Data nasterii: 2022-03-10',
    'Parinte 1: Maria Popescu',
    'Telefon 1: 0722000000',
    'Parinte 2: Ion Popescu',
    'Telefon 2: 0733000000',
    'Data vizitei: 2026-09-20',
    'Ora: 10:00',
    'Data dorita start: 2026-10-01',
    'Grupa dorita: Fluturași',
    'Cum a aflat: Facebook',
  ].join('\n');
  assert.deepEqual(parseVisitPasteTemplate(text, { groups }), {
    name: 'Ana Popescu',
    birthDate: '2022-03-10',
    parent: 'Maria Popescu',
    phone: '0722000000',
    parent2: 'Ion Popescu',
    phone2: '0733000000',
    date: '2026-09-20',
    time: '10:00',
    desiredStartDate: '2026-10-01',
    desiredGroupId: 'GRP-1',
    source: 'Facebook',
  });
});

test('parseVisitPasteTemplate omite câmpurile goale sau lipsă dintr-un șablon parțial', () => {
  const text = ['Copil: Radu Ionescu', 'Data nasterii: ', 'Parinte 1: Elena Ionescu', 'Telefon 1:'].join('\n');
  assert.deepEqual(parseVisitPasteTemplate(text, { groups }), {
    name: 'Radu Ionescu',
    parent: 'Elena Ionescu',
  });
});

test('parseVisitPasteTemplate potrivește etichetele indiferent de diacritice și majuscule', () => {
  const text = ['COPIL: Matei', 'PĂRINTE 1: Vasile', 'Telefon 1: 0711000000'].join('\n');
  assert.deepEqual(parseVisitPasteTemplate(text, { groups }), {
    name: 'Matei',
    parent: 'Vasile',
    phone: '0711000000',
  });
});

test('parseVisitPasteTemplate ignoră liniile nerecunoscute fără să eșueze', () => {
  const text = ['acesta nu e un rând valid', 'Copil: Sofia', 'Notă ciudată: cine știe', ''].join('\n');
  assert.deepEqual(parseVisitPasteTemplate(text, { groups }), { name: 'Sofia' });
});

test('parseVisitPasteTemplate potrivește grupa dorită exact, insensibil la majuscule și diacritice', () => {
  assert.equal(parseVisitPasteTemplate('Grupa dorita: Fluturași', { groups }).desiredGroupId, 'GRP-1');
  assert.equal(parseVisitPasteTemplate('Grupa dorita: fluturasi', { groups }).desiredGroupId, 'GRP-1');
  assert.equal(parseVisitPasteTemplate('Grupa dorita: ALBINUȚE', { groups }).desiredGroupId, 'GRP-2');
});

test('parseVisitPasteTemplate omite desiredGroupId când numele grupei nu se potrivește', () => {
  const result = parseVisitPasteTemplate('Grupa dorita: Grupa Inexistentă', { groups });
  assert.equal('desiredGroupId' in result, false);
});

test('parseVisitPasteTemplate acceptă doar date deja în format AAAA-LL-ZZ', () => {
  const text = ['Data nasterii: 10.03.2022', 'Data vizitei: 2026-09-20', 'Data dorita start: 01/10/2026'].join('\n');
  const result = parseVisitPasteTemplate(text, { groups });
  assert.equal('birthDate' in result, false);
  assert.equal(result.date, '2026-09-20');
  assert.equal('desiredStartDate' in result, false);
});
