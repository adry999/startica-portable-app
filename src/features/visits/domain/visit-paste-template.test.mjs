import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVisitPasteTemplate, VISIT_PASTE_TEMPLATE } from './visit-paste-template.mjs';

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

test('parseVisitPasteTemplate acceptă AAAA-LL-ZZ și respinge formatul ambiguu ZZ/LL/AAAA', () => {
  const text = ['Data vizitei: 2026-09-20', 'Data dorita start: 01/10/2026'].join('\n');
  const result = parseVisitPasteTemplate(text, { groups });
  assert.equal(result.date, '2026-09-20');
  assert.equal('desiredStartDate' in result, false);
});

test('parseVisitPasteTemplate acceptă și data românească ZZ.LL.AAAA, convertind-o în AAAA-LL-ZZ', () => {
  const text = ['Data nasterii: 10.03.2022', 'Data vizitei: 15.09.2026'].join('\n');
  const result = parseVisitPasteTemplate(text, { groups });
  assert.equal(result.birthDate, '2022-03-10');
  assert.equal(result.date, '2026-09-15');
});

test('parseVisitPasteTemplate acceptă ZZ.LL.AAAA scris cu zi sau lună pe o singură cifră', () => {
  const result = parseVisitPasteTemplate('Data vizitei: 5.9.2026', { groups });
  assert.equal(result.date, '2026-09-05');
});

test('parseVisitPasteTemplate respinge o dată calendaristică invalidă în format ZZ.LL.AAAA', () => {
  const result = parseVisitPasteTemplate('Data vizitei: 31.02.2026', { groups });
  assert.equal('date' in result, false);
});

test('parseVisitPasteTemplate potrivește sinonimele naturale pentru numele copilului', () => {
  assert.equal(parseVisitPasteTemplate('Nume copil: Radu', { groups }).name, 'Radu');
  assert.equal(parseVisitPasteTemplate('Nume: Radu', { groups }).name, 'Radu');
});

test('parseVisitPasteTemplate potrivește sinonimele naturale pentru părinte și telefon', () => {
  assert.equal(parseVisitPasteTemplate('Nume parinte: Elena', { groups }).parent, 'Elena');
  assert.equal(parseVisitPasteTemplate('Parinte: Vasile', { groups }).parent, 'Vasile');
  assert.equal(parseVisitPasteTemplate('Telefon: 0722000000', { groups }).phone, '0722000000');
});

test('parseVisitPasteTemplate potrivește sinonimele naturale pentru data vizitei, dar „data” nu se ciocnește cu alte câmpuri de dată', () => {
  assert.equal(parseVisitPasteTemplate('Vizita: 2026-09-20', { groups }).date, '2026-09-20');
  assert.equal(parseVisitPasteTemplate('Data: 2026-09-21', { groups }).date, '2026-09-21');
  const withOtherDates = parseVisitPasteTemplate(
    ['Data nasterii: 2022-01-01', 'Data dorita start: 2026-10-01'].join('\n'),
    { groups },
  );
  assert.equal('date' in withOtherDates, false);
  assert.equal(withOtherDates.birthDate, '2022-01-01');
  assert.equal(withOtherDates.desiredStartDate, '2026-10-01');
});

test('parseVisitPasteTemplate parsează exemplul real al operatorului, cu etichete naturale și dată românească', () => {
  const text = [
    'Nume copil: Ana',
    'Nume parinte: Galina',
    'Telefon: 123',
    'vizita: 15.09.2026',
    'ora: 10:00',
    'alte detalii',
  ].join('\n');
  assert.deepEqual(parseVisitPasteTemplate(text, { groups }), {
    name: 'Ana',
    parent: 'Galina',
    phone: '123',
    date: '2026-09-15',
    time: '10:00',
  });
});

test('VISIT_PASTE_TEMPLATE listează etichetele canonice, în ordinea formularului, gata de completat', () => {
  assert.equal(
    VISIT_PASTE_TEMPLATE,
    'Copil: \nData nașterii: \nPărinte 1: \nTelefon 1: \nPărinte 2: \nTelefon 2: \nData vizitei: \nOra: \nData dorită start: \nGrupa dorită: \nCum a aflat: \n',
  );
});
