import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { normalizeRecord, cashSummary, obligation, paymentTenders } from '../shared/domain.mjs';
import { exportWorkbook, readWorkbook } from '#features/data-transfer/domain/excel-workbook.mjs';
import { findRecordIssues } from '#features/review-center/index.server.mjs';

test('Doi părinți opționali și achitare mixtă: total, repartizare, rapoarte și Excel', () => {
  const c = normalizeRecord('children', {
    id: 'C1',
    name: 'Copil',
    parent: 'P1',
    phone: '00123',
    parent2: 'P2',
    phone2: '+373456',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 1500 }],
  });
  assert.doesNotThrow(() => normalizeRecord('children', { id: 'C0', name: 'Fără contacte' }));
  assert.throws(() => normalizeRecord('children', { ...c, phone2: 123 }));
  const p = normalizeRecord('payments', {
    id: 'P1',
    childId: c.id,
    date: '2026-09-08',
    tenders: [
      { method: 'Cash', amount: 1000.1 },
      { method: 'Card', amount: 500.2 },
    ],
    allocations: [{ month: '2026-09', amount: 1500 }],
  });
  assert.equal(p.amount, 1500.3);
  assert.equal(p.method, 'Cash + Card');
  const s = { children: [c], payments: [p], expenses: [], groups: [], categories: [] },
    summary = cashSummary(s, '2026-09');
  assert.equal(summary.income, 1500.3);
  assert.deepEqual(summary.byMethod, { Cash: 1000.1, Card: 500.2, Transfer: 0, Altele: 0 });
  assert.equal(obligation(c, '2026-09', [p], '2026-09-08').paid, 1500);
  for (const tenders of [
    [],
    [{ method: 'Cash', amount: -1 }],
    [{ method: 'Cash', amount: 1.001 }],
    [
      { method: 'Card', amount: 1 },
      { method: 'card', amount: 2 },
    ],
  ])
    assert.throws(() => normalizeRecord('payments', { ...p, tenders }));
  assert.throws(() => normalizeRecord('payments', { ...p, amount: 999 }));
  assert.throws(() => normalizeRecord('payments', { ...p, allocations: [{ month: '2026-09', amount: 1600 }] }));
  const legacy = { id: 'P2', date: '2026-09-08', amount: 200, method: 'Transfer' };
  assert.deepEqual(paymentTenders(legacy), [{ method: 'Transfer', amount: 200 }]);
  assert.equal(normalizeRecord('payments', legacy).amount, 200);
  assert.equal(cashSummary({ ...s, payments: [{ ...p, archived: true }] }, '2026-09').income, 0);
  const require = createRequire(import.meta.url),
    XLSX = require('../web/vendor/xlsx.full.min.js');
  const wb = XLSX.read(XLSX.write(exportWorkbook(s, XLSX), { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' }),
    back = readWorkbook(wb, XLSX, findRecordIssues);
  assert.deepEqual(back.errors, []);
  assert.deepEqual(back.state, s);
  assert.equal(XLSX.utils.sheet_to_json(wb.Sheets.Copii)[0].Telefon_2, '+373456');
  assert.equal(XLSX.utils.sheet_to_json(wb.Sheets.Achitari)[0].Card, 500.2);
});
