import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderCycle } from './render-cycle.mjs';

function createHarness() {
  const calls = { evaluate: 0, review: 0, hints: 0 };
  const failures = [];
  const records = {
    children: [
      { id: 'C1', archived: false },
      { id: 'C2', archived: true },
    ],
  };
  const renderCycle = createRenderCycle({
    readRecords: () => records,
    readSelectedMonth: () => '2026-09',
    readToday: () => '2026-09-15',
    buildReviewCenter: () => {
      calls.review++;
      return { items: [] };
    },
    evaluateChildrenForMonth: (input, month, asOf) => {
      calls.evaluate++;
      assert.equal(month, '2026-09');
      assert.equal(asOf, '2026-09-15');
      return input.children.map(child => ({ child }));
    },
    findUnassignedPaymentHintsByChild: () => {
      calls.hints++;
      return new Map();
    },
    reportRenderFailure: (screenName, failure) => failures.push({ screenName, failure }),
  });
  return { renderCycle, calls, failures };
}

test('calculează contextul o singură dată și îl dă tuturor ecranelor, în ordinea înregistrării', () => {
  const { renderCycle, calls } = createHarness();
  const rendered = [];
  renderCycle.addScreen('dashboard', context => rendered.push(['dashboard', context.activeEvaluations.length]));
  renderCycle.addScreen('status', context => rendered.push(['status', context.evaluations.length]));

  renderCycle.render();

  assert.deepEqual(rendered, [
    ['dashboard', 1],
    ['status', 2],
  ]);
  assert.deepEqual(calls, { evaluate: 1, review: 1, hints: 1 });
});

test('un ecran care aruncă nu oprește randarea celorlalte', () => {
  const { renderCycle, failures } = createHarness();
  const rendered = [];
  renderCycle.addScreen('dashboard', () => {
    throw new Error('Dashboard stricat');
  });
  renderCycle.addScreen('status', () => rendered.push('status'));

  renderCycle.render();

  assert.deepEqual(rendered, ['status']);
  assert.deepEqual(failures, [
    { screenName: 'dashboard', failure: { message: 'Dashboard stricat', retryable: false } },
  ]);
});
