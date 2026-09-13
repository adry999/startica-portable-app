import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { normalizeRecord, validateState, emptyState } from '#shared/domain/record-schema.mjs';
import { readWorkbook, exportWorkbook, mapV5ChildStatus } from './excel-workbook.mjs';

const require = createRequire(import.meta.url);
// Cale calculată, nu literal: tsc rezolvă static un require(literal) și ar verifica
// tot bundle-ul vendorizat SheetJS, care nu e scris pentru type-checking strict.
const vendorXlsxPath = fileURLToPath(new URL('../../../../web/vendor/xlsx.full.min.js', import.meta.url));
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

test('Export/reimport complet prin fișier XLSX în memorie', () => {
  const s = {
    children: [
      { ...child(), notes: 'Observații', extra: 'câmp păstrat', statusHistory: [{ from: '2026-09', status: 'Activ' }] },
    ],
    payments: [{ ...payment(), archived: true, original: 'sursă', notes: 'a'.repeat(35000) }],
    expenses: [normalizeRecord('expenses', { id: 'EXP-test', date: '2026-09-08', amount: 10.25, category: 'Test' })],
    groups: [{ id: 'GRP-test', name: 'Grupa test', capacity: 10 }],
    categories: [],
  };
  // Extra long field exercises chunking; validation normally caps text at 10k.
  s.payments[0].notes = 'text';
  s.payments[0].extra = 'a'.repeat(35000);
  const bytes = XLSX.write(exportWorkbook(s, XLSX), { type: 'buffer', bookType: 'xlsx' });
  const result = readWorkbook(XLSX.read(bytes, { type: 'buffer' }), XLSX, findRecordIssues);
  assert.deepEqual(result.errors, []);
  assert.ok(result.state);
  assert.deepEqual(result.state, validateState(s));
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
  const r = normalizeRecord('children', { id: 'ID-1', name: 'Copil', dueDay: 10, status: unknown.status });
  assert.equal(r.status, 'De verificat');
});
