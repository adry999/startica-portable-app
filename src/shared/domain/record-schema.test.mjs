import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecord, validateState, CHILD_STATUSES, STATUS_HISTORY_VALUES } from './record-schema.mjs';

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

test('Statutul copilului este restrâns la valorile pe care aplicația le înțelege', () => {
  const base = { id: 'ID-1', name: 'Copil', dueDay: 10 };
  for (const status of CHILD_STATUSES) assert.equal(normalizeRecord('children', { ...base, status }).status, status);
  assert.throws(() => normalizeRecord('children', { ...base, status: 'ORICE TEXT' }), /Statut/);
  assert.equal(normalizeRecord('children', base).status, 'Activ');
  // „De verificat” nu este o stare din care se calculează obligații.
  assert.ok(!STATUS_HISTORY_VALUES.includes('De verificat'));
  assert.throws(
    () => normalizeRecord('children', { ...base, statusHistory: [{ from: '2026-01', status: 'De verificat' }] }),
    /Statut istoric/,
  );
});

test('Validare monetară, dată, identificatori și referințe', () => {
  assert.throws(() => normalizeRecord('children', {}));
  assert.throws(() => normalizeRecord('payments', { ...payment(), amount: -1 }));
  assert.throws(() => normalizeRecord('payments', { ...payment(), date: '2026-02-30' }));
  assert.throws(() => normalizeRecord('payments', { ...payment(), amount: 1.001 }));
  assert.throws(() => normalizeRecord('payments', { ...payment(), amount: 100 }));
  assert.throws(() => validateState({ children: [], payments: [payment()], expenses: [] }));
  assert.throws(() => validateState({ children: [child(), child()], payments: [], expenses: [] }));
  assert.equal(normalizeRecord('children', { ...child(), status: 'Retras' }).status, 'Retras');
});

test('Doi părinți opționali și achitare mixtă se normalizează', () => {
  const childRecord = normalizeRecord('children', {
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
  assert.throws(() => normalizeRecord('children', { ...childRecord, phone2: 123 }));
  const mixedPayment = normalizeRecord('payments', {
    id: 'P1',
    childId: childRecord.id,
    date: '2026-09-08',
    tenders: [
      { method: 'Cash', amount: 1000.1 },
      { method: 'Card', amount: 500.2 },
    ],
    allocations: [{ month: '2026-09', amount: 1500 }],
  });
  assert.equal(mixedPayment.amount, 1500.3);
  assert.equal(mixedPayment.method, 'Cash + Card');
  for (const tenders of [
    [],
    [{ method: 'Cash', amount: -1 }],
    [{ method: 'Cash', amount: 1.001 }],
    [
      { method: 'Card', amount: 1 },
      { method: 'card', amount: 2 },
    ],
  ])
    assert.throws(() => normalizeRecord('payments', { ...mixedPayment, tenders }));
  assert.throws(() => normalizeRecord('payments', { ...mixedPayment, amount: 999 }));
  assert.throws(() =>
    normalizeRecord('payments', { ...mixedPayment, allocations: [{ month: '2026-09', amount: 1600 }] }),
  );
  const legacy = { id: 'P2', date: '2026-09-08', amount: 200, method: 'Transfer' };
  assert.equal(normalizeRecord('payments', legacy).amount, 200);
});

test('Normalizarea păstrează fiecare câmp real și elimină restul', () => {
  // Lista provine din inventarul bazei reale: 105 fișe, 810 achitări, 1201
  // cheltuieli. Dacă unul dintre câmpurile astea ar fi eliminat, restaurarea
  // unui backup vechi ar pierde date în tăcere.
  const real = {
    children: {
      id: 'CSV-1',
      contractNumber: '1',
      name: 'Copil',
      parent: 'P1',
      phone: '060',
      parent2: 'P2',
      phone2: '061',
      birthDate: '2020-01-02',
      contractDate: '2024-11-14',
      attendanceDate: '2024-12-02',
      withdrawalDate: '2026-01-05',
      status: 'Activ',
      groupId: 'GRP-mica',
      fee: 2000,
      feeHistory: [{ from: '2024-12', amount: 2000 }],
      statusHistory: [{ from: '2024-12', status: 'Activ' }],
      dueDay: 14,
      notes: 'observatii',
      verification: 'OK',
      archived: false,
      archivedAt: '',
    },
    payments: {
      id: 'PAY-1',
      date: '2026-09-01',
      childId: 'CSV-1',
      childName: 'Copil',
      sourceName: 'sursa',
      sourceChildId: 'ID-9',
      group: 'Mica',
      method: 'Cash',
      amount: 2000,
      allocations: [{ month: '2026-09', amount: 2000 }],
      month: '2026-09',
      type: 'lunar',
      notes: 'n',
      verification: 'OK',
      original: 'text sursa',
      reviewed: true,
      importSource: { kind: 'v5-financial', recordId: 'X' },
      archived: false,
      archivedAt: '',
    },
    expenses: {
      id: 'EXP-1',
      date: '2026-09-01',
      category: 'Altele',
      description: 'd',
      amount: 10,
      notes: 'n',
      importSource: { kind: 'v5-financial', recordId: 'Y' },
      archived: false,
      archivedAt: '',
    },
  };
  for (const [type, record] of Object.entries(real)) {
    const clean = normalizeRecord(type, record);
    for (const field of Object.keys(record))
      assert.ok(field in clean, `${type}: câmpul ${field} a fost eliminat, deși există în datele reale`);
  }

  // Ce nu e în model nu mai ajunge în bază.
  const withJunk = normalizeRecord('children', { ...real.children, campNecunoscut: { a: 1 }, altceva: 'x' });
  assert.ok(!('campNecunoscut' in withJunk));
  assert.ok(!('altceva' in withJunk));
  // Un câmp al altui tip nu trece nici el.
  assert.ok(!('tenders' in normalizeRecord('expenses', { ...real.expenses, tenders: [] })));
});
