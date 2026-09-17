import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { summary } from '#shared/domain/records-report.mjs';
import { v5FinancialSource } from '../test-support/financial-history-fixtures.mjs';
import { buildImportReport } from './import-report.mjs';

test('o stare validă întoarce starea normalizată, rezumatul și avertizările din findRecordIssues, primite pe starea normalizată', () => {
  const { state } = v5FinancialSource();
  const warningsFor = [];
  /** @type {import('../data-transfer.types.mjs').FindRecordIssues} */
  const findRecordIssues = normalizedState => {
    warningsFor.push(normalizedState);
    return [{ reason: 'copil fără dată de naștere completă' }];
  };

  const report = buildImportReport(state, findRecordIssues);

  assert.deepEqual(report.errors, []);
  assert.ok(report.state);
  assert.deepEqual(report.summary, summary(report.state));
  assert.deepEqual(report.warnings, [{ reason: 'copil fără dată de naștere completă' }]);
  assert.equal(warningsFor[0], report.state);
});

test('o stare invalidă întoarce doar eroarea, fără avertizări sau stare', () => {
  const invalidState = {
    children: [],
    payments: [
      normalizeRecord('payments', { id: 'PAY-1', date: '2026-09-01', amount: 100, method: 'Cash', childId: 'LIPSA' }),
    ],
    expenses: [],
    groups: [],
    categories: [],
    visits: [],
  };

  const report = buildImportReport(invalidState, () => []);

  assert.equal(report.errors.length, 1);
  assert.match(report.errors[0], /copilul LIPSA nu există/);
  assert.deepEqual(report.warnings, []);
  assert.equal(report.state, undefined);
});

test('formatul vechi cu grupa copilului ca text este convertit, cu notă despre grupa creată', () => {
  const legacyState = {
    children: [{ id: 'ID-1', name: 'Copil Vechi', group: 'Fluturași' }],
    payments: [],
    expenses: [],
    groups: [],
    categories: [],
    visits: [],
  };

  const report = buildImportReport(legacyState, () => []);

  assert.deepEqual(report.errors, []);
  assert.ok(report.notes);
  assert.ok(report.state);
  assert.match(report.notes[0], /1 grupă creată/);
  assert.equal(report.state.groups.length, 1);
  assert.equal(report.state.children[0].groupId, report.state.groups[0].id);
});
