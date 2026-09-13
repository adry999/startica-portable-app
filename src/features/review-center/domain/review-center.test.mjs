import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, normalizeRecord } from '#shared/domain/record-schema.mjs';
import { buildReviewCenter, filterReviewItems } from './review-center.mjs';

const child = (id, name = 'Copil Test') =>
  normalizeRecord('children', {
    id,
    name,
    status: 'Activ',
    attendanceDate: '2026-01-01',
    feeHistory: [{ from: '2026-01', amount: 500 }],
  });
const payment = (id, changes = {}) =>
  normalizeRecord('payments', {
    id,
    childId: 'C1',
    date: '2026-01-10',
    amount: 100,
    method: 'Card',
    sourceName: 'Părinte Test',
    ...changes,
  });

test('centrul de verificare grupează problemele pe înregistrare și oferă confirmare doar pentru potriviri automate', () => {
  const state = emptyState();
  state.children = [child('C1')];
  state.payments = [
    payment('P-auto', { verification: 'POTRIVIRE AUTOMATĂ - verifică' }),
    payment('P-nealocat', { childId: '', verification: 'DE VERIFICAT - copil neasociat' }),
    payment('P-provizoriu', {
      verification: 'DE VERIFICAT - metodă mixtă',
      notes: 'Sumă provizorie',
      importSource: { provisionalAmount: true },
    }),
    payment('P-avans', { allocations: [] }),
    payment('P-duplicat'),
    payment('P-duplicat-2'),
  ];
  const center = buildReviewCenter(state);
  assert.equal(center.progress.total, 3);
  assert.equal(center.items.filter(item => item.id === 'P-auto').length, 1);
  const itemById = id => /** @type {any} */ (center.items.find(item => item.id === id));
  assert.equal(itemById('P-auto').canConfirm, true);
  assert.equal(itemById('P-nealocat').canConfirm, false);
  assert.ok(itemById('P-provizoriu').categories.includes('provisional'));
  assert.ok(itemById('P-avans').categories.includes('advance'));
  assert.ok(itemById('P-duplicat-2').categories.includes('duplicate'));
  assert.deepEqual(
    filterReviewItems(center, 'unassigned').map(item => item.id),
    ['P-nealocat'],
  );
  assert.deepEqual(
    filterReviewItems(center, 'automatic').map(item => item.id),
    ['P-auto'],
  );
});

test('filtrarea caută după observația sursei și păstrează fișele cu date incomplete', () => {
  const state = emptyState();
  state.children = [normalizeRecord('children', { id: 'C2', name: 'Copil incomplet', status: 'De verificat' })];
  state.payments = [
    payment('P-provizoriu', {
      verification: 'DE VERIFICAT - metodă mixtă',
      notes: 'Sumă provizorie',
      importSource: { provisionalAmount: true },
    }),
  ];
  const center = buildReviewCenter(state);
  assert.equal(filterReviewItems(center, 'children').length, 1);
  assert.deepEqual(
    filterReviewItems(center, 'all', 'provizorie').map(item => item.id),
    ['P-provizoriu'],
  );
});
