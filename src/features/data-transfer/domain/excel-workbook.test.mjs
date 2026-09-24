import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { normalizeRecord, validateState, emptyState } from '#shared/domain/record-schema.mjs';
import { readWorkbook, exportWorkbook, mapV5ChildStatus } from './excel-workbook.mjs';

const require = createRequire(import.meta.url);
// Cale calculată, nu literal: tsc rezolvă static un require(literal) și ar verifica
// tot bundle-ul SheetJS, care nu e scris pentru type-checking strict.
// De la cutover (redesign React), vendor-ul din web/vendor a dispărut — SheetJS
// vine din dependența npm a webapp/-ului, singurul loc din repo cu deps reale.
const vendorXlsxPath = fileURLToPath(new URL('../../../../webapp/node_modules/xlsx/xlsx.js', import.meta.url));
const XLSX = require(vendorXlsxPath);

// review-center deține findRecordIssues; niciun test de aici nu verifică avertizările
// de conținut, deci o listă goală e echivalentă comportamental pentru aceste cazuri.
const findRecordIssues = () => [];

const child = () =>
  normalizeRecord('children', {
    id: 'ID-test',
    name: 'Copil test',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    fee: 2000,
    dueDay: 10,
    feeHistory: [{ from: '2026-09', amount: 2000 }],
  });
const payment = () =>
  normalizeRecord('payments', {
    id: 'PAY-test',
    childId: 'ID-test',
    date: '2026-09-08',
    amount: 3000,
    method: 'Cash',
    allocations: [
      { month: '2026-09', amount: 2000 },
      { month: '2026-10', amount: 500 },
    ],
  });
const visit = () =>
  normalizeRecord('visits', {
    id: 'VIZ-test',
    name: 'Copil vizitator',
    parent: 'Maria',
    date: '2026-09-08',
    time: '10:00',
    status: 'Programată',
    statusChangedAt: '2026-09-01T10:00:00.000Z',
  });

test('Export/reimport complet prin fișier XLSX în memorie', () => {
  const state = {
    children: [
      { ...child(), notes: 'Observații', extra: 'câmp păstrat', statusHistory: [{ from: '2026-09', status: 'Activ' }] },
    ],
    payments: [{ ...payment(), archived: true, original: 'sursă', notes: 'a'.repeat(35000) }],
    expenses: [normalizeRecord('expenses', { id: 'EXP-test', date: '2026-09-08', amount: 10.25, category: 'Test' })],
    groups: [{ id: 'GRP-test', name: 'Grupa test', capacity: 10 }],
    categories: [],
    visits: [],
  };
  // Extra long field exercises chunking; validation normally caps text at 10k.
  state.payments[0].notes = 'text';
  state.payments[0].extra = 'a'.repeat(35000);
  const bytes = XLSX.write(exportWorkbook(state, XLSX), { type: 'buffer', bookType: 'xlsx' });
  const result = readWorkbook(XLSX.read(bytes, { type: 'buffer' }), XLSX, findRecordIssues);
  assert.deepEqual(result.errors, []);
  assert.ok(result.state);
  assert.deepEqual(result.state, validateState(state));
  const zero = readWorkbook(exportWorkbook(emptyState(), XLSX), XLSX, findRecordIssues);
  assert.ok(zero.state);
  assert.deepEqual(zero.state, emptyState());
});

test('Importul refuză exporturi necunoscute în loc să importe liste goale', () => {
  const wb = XLSX.utils.book_new();
  for (const name of ['Copii', 'Achitari', 'Cheltuieli'])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['ID'], ['ID-test']]), name);
  assert.ok(readWorkbook(wb, XLSX, findRecordIssues).errors.length);
});

test('V5 original: numărul de înregistrări și totalurile rămân identice', () => {
  const source = new URL('../../../../../Fisiere_Excel/Evidenta_Achitari_corectata%20v5.xlsx', import.meta.url);
  if (!existsSync(source)) return;
  const wb = XLSX.read(readFileSync(source), { type: 'buffer' }),
    report = readWorkbook(wb, XLSX, findRecordIssues);
  assert.deepEqual(report.errors, []);
  assert.ok(report.state);
  assert.ok(report.summary);
  assert.deepEqual(report.summary, {
    children: 105,
    payments: 810,
    expenses: 1201,
    groups: 10,
    categories: 0,
    visits: 0,
    paymentTotal: 10105096,
    expenseTotal: 1564059,
  });
  const roundtrip = readWorkbook(
    XLSX.read(XLSX.write(exportWorkbook(report.state, XLSX), { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' }),
    XLSX,
    findRecordIssues,
  );
  assert.deepEqual(roundtrip.errors, []);
  assert.ok(roundtrip.state);
  assert.deepEqual(roundtrip.state, report.state);
});

test('Importul V5 mapează un statut necunoscut, păstrând textul original', () => {
  assert.deepEqual(mapV5ChildStatus(''), { status: 'Activ', note: '' });
  assert.deepEqual(mapV5ChildStatus('  activ '), { status: 'Activ', note: '' });
  assert.deepEqual(mapV5ChildStatus('Retras'), { status: 'Retras', note: '' });
  const unknown = mapV5ChildStatus('Inactiv temporar');
  assert.equal(unknown.status, 'De verificat');
  assert.match(unknown.note, /Inactiv temporar/);
  // Rândul trebuie să treacă validarea, nu să fie respins.
  const normalized = normalizeRecord('children', { id: 'ID-1', name: 'Copil', dueDay: 10, status: unknown.status });
  assert.equal(normalized.status, 'De verificat');
});

test('Doi părinți și achitarea mixtă trec prin export și import', () => {
  const child = normalizeRecord('children', {
    id: 'C1',
    name: 'Copil',
    parent: 'P1',
    phone: '00123',
    parent2: 'P2',
    phone2: '+373456',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 1500 }],
  });
  const payment = normalizeRecord('payments', {
    id: 'P1',
    childId: child.id,
    date: '2026-09-08',
    tenders: [
      { method: 'Cash', amount: 1000.1 },
      { method: 'Card', amount: 500.2 },
    ],
    allocations: [{ month: '2026-09', amount: 1500 }],
  });
  const state = { children: [child], payments: [payment], expenses: [], groups: [], categories: [], visits: [] };
  const wb = XLSX.read(XLSX.write(exportWorkbook(state, XLSX), { type: 'buffer', bookType: 'xlsx' }), {
      type: 'buffer',
    }),
    back = readWorkbook(wb, XLSX, findRecordIssues);
  assert.deepEqual(back.errors, []);
  assert.deepEqual(back.state, state);
  assert.equal(XLSX.utils.sheet_to_json(wb.Sheets.Copii)[0].Telefon_2, '+373456');
  assert.equal(XLSX.utils.sheet_to_json(wb.Sheets.Achitari)[0].Card, 500.2);
});

test('exportul Excel însumează componentele plății fără erori de virgulă mobilă', () => {
  const child = normalizeRecord('children', {
    id: 'C1',
    name: 'Copil',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 1500 }],
  });
  const payment1 = normalizeRecord('payments', {
    id: 'P1',
    childId: child.id,
    date: '2026-09-08',
    tenders: [
      { method: 'Cash', amount: 0.1 },
      { method: 'Card', amount: 0.2 },
    ],
    allocations: [{ month: '2026-09', amount: 0.3 }],
  });
  const payment2 = normalizeRecord('payments', {
    id: 'P2',
    childId: child.id,
    date: '2026-09-09',
    tenders: [
      { method: 'Cash', amount: 1234.56 },
      { method: 'Transfer', amount: 0.01 },
    ],
    allocations: [{ month: '2026-09', amount: 1234.57 }],
  });
  const state = {
    children: [child],
    payments: [payment1, payment2],
    expenses: [],
    groups: [],
    categories: [],
    visits: [],
  };
  const wb = exportWorkbook(state, XLSX);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.Achitari);
  assert.equal(rows[0].Cash, 0.1);
  assert.equal(rows[0].Card, 0.2);
  assert.equal(rows[1].Cash, 1234.56);
  assert.equal(rows[1].Transfer, 0.01);
});

test('Datele medicale nu ajung în fila Startica_Date, iar reimportul le lasă goale', () => {
  const childRecord = normalizeRecord('children', { ...child(), healthNotes: 'Alergie la nuci' });
  const visitRecord = normalizeRecord('visits', { ...visit(), healthNotes: 'Astm ușor' });
  const state = {
    children: [childRecord],
    payments: [],
    expenses: [],
    groups: [],
    categories: [],
    visits: [visitRecord],
  };
  const wb = exportWorkbook(state, XLSX);
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets.Startica_Date, { header: 1 });
  const rawJson = rawRows.map(row => row[3]).join('');
  assert.ok(!rawJson.includes('healthNotes'));
  assert.ok(!rawJson.includes('Alergie la nuci'));
  assert.ok(!rawJson.includes('Astm ușor'));

  const formatText = XLSX.utils
    .sheet_to_json(wb.Sheets.Startica_Format, { header: 1 })
    .map(row => row[0])
    .join('\n');
  assert.match(formatText, /Datele medicale \(vizite, copii\) nu sunt exportate/);

  const back = readWorkbook(
    XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' }),
    XLSX,
    findRecordIssues,
  );
  assert.deepEqual(back.errors, []);
  assert.ok(back.state);
  assert.equal(back.state.visits[0].healthNotes, '');
  assert.equal(back.state.children[0].healthNotes, undefined);
});
