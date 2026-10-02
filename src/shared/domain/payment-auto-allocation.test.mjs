import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecord } from './record-schema.mjs';
import { autoAllocatePayment } from './payment-auto-allocation.mjs';

const child = (overrides = {}) =>
  normalizeRecord('children', {
    id: 'ID-test',
    name: 'Copil test',
    status: 'Activ',
    attendanceDate: '2026-01-01',
    dueDay: 10,
    feeHistory: [{ from: '2026-01', amount: 1000 }],
    ...overrides,
  });

const base = { payments: [], charges: [], rates: {}, asOf: '2026-03-15', paymentMonth: '2026-03' };

test('F7: plată exactă — un singur rând, luna plății', () => {
  const rows = autoAllocatePayment({ child: child(), ...base, amount: 1000 });
  assert.deepEqual(rows, [{ month: '2026-03', amount: 1000 }]);
});

test('F7: plată dublă — surplusul trece pe luna următoare, ca avans', () => {
  const rows = autoAllocatePayment({ child: child(), ...base, amount: 2000 });
  assert.deepEqual(rows, [
    { month: '2026-03', amount: 1000 },
    { month: '2026-04', amount: 1000 },
  ]);
});

test('F7: plată parțială — un singur rând, sub taxa lunii', () => {
  const rows = autoAllocatePayment({ child: child(), ...base, amount: 400 });
  assert.deepEqual(rows, [{ month: '2026-03', amount: 400 }]);
});

test('F7: restanță NEbifată — nu intră automat în repartizare', () => {
  // Februarie neachitat (nicio plată), dar arrearMonths rămâne gol.
  const rows = autoAllocatePayment({ child: child(), ...base, amount: 1000, arrearMonths: [] });
  assert.deepEqual(rows, [{ month: '2026-03', amount: 1000 }]);
});

test('F7: restanță bifată — se acoperă întâi ea, apoi luna plății cu ce rămâne', () => {
  const rows = autoAllocatePayment({ child: child(), ...base, amount: 1500, arrearMonths: ['2026-02'] });
  assert.deepEqual(rows, [
    { month: '2026-02', amount: 1000 },
    { month: '2026-03', amount: 500 },
  ]);
});

test('F7: restanță bifată, sumă exact cât restanța — nu adaugă rând pentru luna plății', () => {
  const rows = autoAllocatePayment({ child: child(), ...base, amount: 1000, arrearMonths: ['2026-02'] });
  assert.deepEqual(rows, [{ month: '2026-02', amount: 1000 }]);
});

test('F7: fără taxă cunoscută — toată suma rămâne pe luna plății (fallback)', () => {
  const rows = autoAllocatePayment({ child: child({ feeHistory: [] }), ...base, amount: 777 });
  assert.deepEqual(rows, [{ month: '2026-03', amount: 777 }]);
});

test('F7: sumă zero sau negativă — niciun rând', () => {
  assert.deepEqual(autoAllocatePayment({ child: child(), ...base, amount: 0 }), []);
  assert.deepEqual(autoAllocatePayment({ child: child(), ...base, amount: -50 }), []);
});

// DECIZII.md (02.10, „Rotunjire la achitare”): surplusul mic (≤ 5 lei, ex. conversie EUR cu bani)
// rămâne pe luna plății, nu pornește o lună nouă de avans — vezi roundingDiff pe plată (payment-form.ts).
test('DECIZII 02.10: surplus în toleranță (≤5 lei) rămâne pe luna plății, nu pornește avans', () => {
  const rows = autoAllocatePayment({ child: child(), ...base, amount: 1003 });
  assert.deepEqual(rows, [{ month: '2026-03', amount: 1003 }]);
});

test('DECIZII 02.10: surplus exact la limita toleranței (5 lei) rămâne tot pe luna plății', () => {
  const rows = autoAllocatePayment({ child: child(), ...base, amount: 1005 });
  assert.deepEqual(rows, [{ month: '2026-03', amount: 1005 }]);
});

test('DECIZII 02.10: surplus peste toleranță (5,01 lei) pornește avans ca înainte', () => {
  const rows = autoAllocatePayment({ child: child(), ...base, amount: 1005.01 });
  assert.deepEqual(rows, [
    { month: '2026-03', amount: 1000 },
    { month: '2026-04', amount: 5.01 },
  ]);
});
