import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState } from '#shared/domain/record-schema.mjs';
import { planFinancialHistoryImport } from './financial-history-import.mjs';
import { currentMatchingChild, v5FinancialSource } from '../test-support/financial-history-fixtures.mjs';

test('Istoric: mapare exactă, fără înlocuire, sume provizorii și reimport', () => {
  const currentChild = currentMatchingChild(),
    source = v5FinancialSource();
  const current = { ...emptyState(), children: [currentChild] },
    before = structuredClone(current),
    input = structuredClone(source);
  const plan = planFinancialHistoryImport(source, current);
  assert.equal(plan.additions.payments[0].childId, 'CSV-1');
  assert.equal(plan.additions.payments[0].amount, 100);
  assert.equal(plan.additions.payments[0].original, 'Text sursă');
  assert.match(plan.additions.payments[0].verification ?? '', /PROVIZORIE/);
  assert.equal(plan.additions.payments[0].tenders, undefined);
  assert.deepEqual(current, before);
  assert.deepEqual(source, input);
  const imported = { children: [currentChild], ...plan.additions };
  imported.payments[0].notes = 'Corectat de utilizator';
  const replay = planFinancialHistoryImport(source, imported);
  assert.equal(replay.summary.payments, 0);
  assert.equal(replay.skipped.expenses, 1);
  assert.equal(imported.payments[0].notes, 'Corectat de utilizator');
  const changed = structuredClone(source);
  changed.state.payments[0].amount = 200;
  assert.throws(() => planFinancialHistoryImport(changed, imported), /sursă modificată/);
  for (const children of [
    [],
    [{ ...currentChild, birthDate: '2023-01-01' }],
    [currentChild, { ...currentChild, id: 'CSV-2' }],
  ])
    assert.throws(() => planFinancialHistoryImport(source, { ...current, children }), /corespondență unică/);
  assert.throws(
    () =>
      planFinancialHistoryImport(source, {
        ...current,
        payments: [{ ...plan.additions.payments[0], importSource: undefined }],
      }),
    /ID deja existent/,
  );
  const unassigned = structuredClone(source);
  unassigned.state.payments[0].childId = '';
  assert.equal(planFinancialHistoryImport(unassigned, current).additions.payments[0].childId, '');
});
