import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, normalizeRecord } from '#shared/domain/record-schema.mjs';
import { findRecordIssues } from './record-issues.mjs';

test('semnalează o fișă de copil fără taxă, grupă sau statut valid', () => {
  const state = emptyState();
  state.children = [normalizeRecord('children', { id: 'C1', name: 'Copil Test', status: 'De verificat' })];
  const issues = findRecordIssues(state);
  assert.ok(issues.some(issue => issue.id === 'C1' && issue.reason === 'Taxă lipsă'));
  assert.ok(issues.some(issue => issue.id === 'C1' && issue.reason === 'Grupă lipsă'));
  assert.ok(issues.some(issue => issue.id === 'C1' && issue.reason === 'Statut de verificat'));
});

test('semnalează o achitare fără copil asociat și un posibil duplicat', () => {
  const state = emptyState();
  state.payments = [
    normalizeRecord('payments', { id: 'P1', childId: '', date: '2026-01-10', amount: 100, method: 'Card' }),
    normalizeRecord('payments', { id: 'P2', childId: 'C1', date: '2026-01-10', amount: 100, method: 'Card' }),
    normalizeRecord('payments', { id: 'P3', childId: 'C1', date: '2026-01-10', amount: 100, method: 'Card' }),
  ];
  const issues = findRecordIssues(state);
  assert.ok(issues.some(issue => issue.id === 'P1' && issue.reason === 'Copil neasociat'));
  assert.ok(issues.some(issue => issue.id === 'P3' && issue.reason === 'Posibil duplicat cu P2'));
});
