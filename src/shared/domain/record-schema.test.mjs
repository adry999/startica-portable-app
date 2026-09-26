import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRecord,
  validateState,
  CHILD_STATUSES,
  STATUS_HISTORY_VALUES,
  VISIT_STATUSES,
  stripSensitiveFields,
  redactSensitiveFields,
} from './record-schema.mjs';

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

test('O vizită validă se normalizează cu implicitele ei', () => {
  const normalized = visit();
  assert.equal(normalized.status, 'Programată');
  assert.equal(normalized.childId, '');
  assert.deepEqual(normalized.history, []);
  assert.equal(normalized.desiredGroupId, null);
  assert.equal(normalized.healthNotes, '');
});

test('Vizita refuză o oră care nu are forma HH:MM', () => {
  assert.throws(() => normalizeRecord('visits', { ...visit(), time: '9:00' }), /Ora vizitei/);
  assert.throws(() => normalizeRecord('visits', { ...visit(), time: '25:00' }), /Ora vizitei/);
  assert.doesNotThrow(() => normalizeRecord('visits', { ...visit(), time: '09:00' }));
});

test('Vizita refuză o dată invalidă a vizitei sau a nașterii', () => {
  assert.throws(() => normalizeRecord('visits', { ...visit(), date: '2026-02-30' }), /Data vizitei/);
  assert.throws(() => normalizeRecord('visits', { ...visit(), birthDate: '2026-13-01' }), /Data nașterii/);
});

test('Vizita refuză un statut în afara VISIT_STATUSES', () => {
  assert.throws(() => normalizeRecord('visits', { ...visit(), status: 'Anulată' }), /Statut/);
  for (const status of VISIT_STATUSES.filter(s => s !== 'Înscris'))
    assert.doesNotThrow(() => normalizeRecord('visits', { ...visit(), status }));
});

test('Vizita refuză o dată de schimbare a statutului invalidă', () => {
  assert.throws(() => normalizeRecord('visits', { ...visit(), statusChangedAt: 'ieri' }), /schimbării de statut/);
});

test('Vizita cere childId doar la statutul Înscris; oriunde altundeva e interzis', () => {
  assert.throws(() => normalizeRecord('visits', { ...visit(), status: 'Înscris' }), /copil asociat/);
  assert.doesNotThrow(() => normalizeRecord('visits', { ...visit(), status: 'Înscris', childId: 'ID-copil' }));
  assert.throws(
    () => normalizeRecord('visits', { ...visit(), status: 'Efectuată', childId: 'ID-copil' }),
    /Doar o vizită înscrisă/,
  );
});

test('Istoricul vizitei refuză o intrare invalidă, mai mult de 1000 de intrări sau ordinea greșită', () => {
  assert.throws(
    () =>
      normalizeRecord('visits', {
        ...visit(),
        history: [{ at: 'nu', status: 'Programată', date: '2026-09-08', time: '10:00' }],
      }),
    /history/,
  );
  assert.throws(
    () =>
      normalizeRecord('visits', {
        ...visit(),
        history: new Array(1001).fill({
          at: '2026-01-01T00:00:00.000Z',
          status: 'Programată',
          date: '2026-01-01',
          time: '10:00',
        }),
      }),
    /history/,
  );
  assert.throws(
    () =>
      normalizeRecord('visits', {
        ...visit(),
        history: [
          { at: '2026-09-02T00:00:00.000Z', status: 'Programată', date: '2026-09-08', time: '10:00' },
          { at: '2026-09-01T00:00:00.000Z', status: 'Efectuată', date: '2026-09-08', time: '10:00' },
        ],
      }),
    /ordonate cronologic/,
  );
  const ordered = normalizeRecord('visits', {
    ...visit(),
    history: [
      { at: '2026-09-01T00:00:00.000Z', status: 'Programată', date: '2026-09-08', time: '10:00' },
      { at: '2026-09-02T00:00:00.000Z', status: 'Efectuată', date: '2026-09-08', time: '10:00' },
    ],
  });
  assert.equal(ordered.history.length, 2);
});

test('desiredGroupId al vizitei acceptă un id valid și refuză un format invalid', () => {
  assert.throws(() => normalizeRecord('visits', { ...visit(), desiredGroupId: 'grupă invalidă!' }), /Grupa dorită/);
  assert.doesNotThrow(() => normalizeRecord('visits', { ...visit(), desiredGroupId: 'GRP-1' }));
});

test('validateState refuză o vizită cu childId sau desiredGroupId inexistent', () => {
  const withMissingChild = { ...visit(), status: 'Înscris', childId: 'ID-fantoma' };
  assert.throws(
    () =>
      validateState({
        children: [],
        payments: [],
        expenses: [],
        groups: [],
        categories: [],
        visits: [withMissingChild],
      }),
    /copilul ID-fantoma nu există/,
  );
  const withMissingGroup = { ...visit(), desiredGroupId: 'GRP-fantoma' };
  assert.throws(
    () =>
      validateState({
        children: [],
        payments: [],
        expenses: [],
        groups: [],
        categories: [],
        visits: [withMissingGroup],
      }),
    /grupa GRP-fantoma nu există/,
  );
});

test('validateState acceptă o vizită cu childId și desiredGroupId existente', () => {
  const childRecord = child();
  const groupRecord = normalizeRecord('groups', { id: 'GRP-1', name: 'Grupa mare' });
  const enrolled = { ...visit(), status: 'Înscris', childId: childRecord.id, desiredGroupId: groupRecord.id };
  assert.doesNotThrow(() =>
    validateState({
      children: [childRecord],
      payments: [],
      expenses: [],
      groups: [groupRecord],
      categories: [],
      visits: [enrolled],
    }),
  );
});

test('payments.reviewed acceptă doar boolean', () => {
  assert.throws(() => normalizeRecord('payments', { ...payment(), reviewed: 'yes' }), /Verificare invalidă/);
  assert.equal(normalizeRecord('payments', { ...payment(), reviewed: true }).reviewed, true);
});

test('payments.importSource acceptă doar un obiect', () => {
  assert.throws(() => normalizeRecord('payments', { ...payment(), importSource: 42 }), /Sursă import invalidă/);
  assert.throws(() => normalizeRecord('payments', { ...payment(), importSource: 'text' }), /Sursă import invalidă/);
  assert.throws(() => normalizeRecord('payments', { ...payment(), importSource: ['a'] }), /Sursă import invalidă/);
  assert.deepEqual(
    normalizeRecord('payments', { ...payment(), importSource: { kind: 'v5-financial', recordId: 'X' } }).importSource,
    { kind: 'v5-financial', recordId: 'X' },
  );
});

test('payments.sourceChildId acceptă doar text', () => {
  assert.throws(() => normalizeRecord('payments', { ...payment(), sourceChildId: 42 }), /sourceChildId/);
  assert.equal(normalizeRecord('payments', { ...payment(), sourceChildId: 'ID-9' }).sourceChildId, 'ID-9');
});

test('archivedAt acceptă sentinela goală, dar refuză un text care nu e o dată', () => {
  assert.throws(
    () => normalizeRecord('payments', { ...payment(), archivedAt: 'not-a-date' }),
    /Data arhivării este invalidă/,
  );
  assert.equal(
    normalizeRecord('payments', { ...payment(), archivedAt: '2026-01-15T10:00:00.000Z' }).archivedAt,
    '2026-01-15T10:00:00.000Z',
  );
  assert.equal(normalizeRecord('payments', { ...payment(), archivedAt: '' }).archivedAt, '');
  assert.equal(normalizeRecord('payments', { ...payment(), archivedAt: null }).archivedAt, null);
});

test('payments.childId refuză un format care nu e de tip ID', () => {
  assert.throws(() => normalizeRecord('payments', { ...payment(), childId: 'nu e un id valid!' }), /ID copil invalid/);
  assert.throws(() => normalizeRecord('payments', { ...payment(), childId: 'x'.repeat(101) }), /ID copil invalid/);
  assert.equal(normalizeRecord('payments', { ...payment(), childId: 'c1' }).childId, 'c1');
  assert.equal(normalizeRecord('payments', { ...payment(), childId: '' }).childId, '');
});

test('children.healthNotes trece prin normalizare ca orice câmp text opțional', () => {
  const withHealthNotes = normalizeRecord('children', { ...child(), healthNotes: 'Alergie la nuci' });
  assert.equal(withHealthNotes.healthNotes, 'Alergie la nuci');
  assert.equal(normalizeRecord('children', child()).healthNotes, undefined);
});

test('stripSensitiveFields elimină healthNotes din vizite și copii, fără să atingă alte tipuri', () => {
  const stripped = stripSensitiveFields('visits', { ...visit(), healthNotes: 'Alergie' });
  assert.ok(!('healthNotes' in stripped));
  const strippedChild = stripSensitiveFields('children', { ...child(), healthNotes: 'Astm' });
  assert.ok(!('healthNotes' in strippedChild));
  const paymentRecord = payment();
  assert.deepEqual(stripSensitiveFields('payments', paymentRecord), paymentRecord);
});

test('redactSensitiveFields înlocuiește o valoare medicală ne-goală, dar lasă valoarea goală neschimbată', () => {
  const redacted = redactSensitiveFields('visits', { ...visit(), healthNotes: 'Alergie la nuci' });
  assert.equal(redacted.healthNotes, '[date medicale]');
  const stillEmpty = redactSensitiveFields('visits', { ...visit(), healthNotes: '' });
  assert.equal(stillEmpty.healthNotes, '');
  const redactedChild = redactSensitiveFields('children', { ...child(), healthNotes: 'Astm' });
  assert.equal(redactedChild.healthNotes, '[date medicale]');
  assert.equal(redactSensitiveFields('payments', null), null);
  assert.equal(redactSensitiveFields(null, { healthNotes: 'x' }).healthNotes, 'x');
});

test('normalizeRecord(children) pune currency "MDL" pe o intrare feeHistory fără monedă', () => {
  const record = normalizeRecord('children', {
    id: 'C-1',
    name: 'Ana',
    parent: 'Maria',
    feeHistory: [{ from: '2026-09', amount: 2000 }],
  });
  assert.deepEqual(record.feeHistory, [{ from: '2026-09', amount: 2000, currency: 'MDL' }]);
});

test('normalizeRecord(children) păstrează currency EUR când e trimisă explicit', () => {
  const record = normalizeRecord('children', {
    id: 'C-1',
    name: 'Ana',
    parent: 'Maria',
    feeHistory: [{ from: '2026-09', amount: 500, currency: 'EUR' }],
  });
  assert.deepEqual(record.feeHistory, [{ from: '2026-09', amount: 500, currency: 'EUR' }]);
});

test('normalizeRecord(children) respinge o monedă necunoscută în feeHistory', () => {
  assert.throws(
    () =>
      normalizeRecord('children', {
        id: 'C-1',
        name: 'Ana',
        parent: 'Maria',
        feeHistory: [{ from: '2026-09', amount: 500, currency: 'USD' }],
      }),
    /monedă/i,
  );
});

test('normalizeRecord(payments) pune currency "MDL" implicit', () => {
  const record = normalizeRecord('payments', {
    id: 'P-1',
    date: '2026-09-15',
    amount: 500,
    method: 'Cash',
  });
  assert.equal(record.currency, 'MDL');
});

test('normalizeRecord(payments) păstrează currency EUR când e trimisă explicit', () => {
  const record = normalizeRecord('payments', {
    id: 'P-1',
    date: '2026-09-15',
    amount: 500,
    method: 'Cash',
    currency: 'EUR',
  });
  assert.equal(record.currency, 'EUR');
});

test('normalizeRecord(expenses) acceptă o metodă validă, dar respinge una necunoscută', () => {
  const base = { id: 'EXP-1', date: '2026-09-01', amount: 100 };
  assert.equal(normalizeRecord('expenses', { ...base, method: 'cash' }).method, 'cash');
  assert.equal(normalizeRecord('expenses', { ...base, method: 'card' }).method, 'card');
  assert.equal(normalizeRecord('expenses', { ...base, method: 'transfer' }).method, 'transfer');
  assert.throws(() => normalizeRecord('expenses', { ...base, method: 'bitcoin' }), /Metodă necunoscută/);
});

test('normalizeRecord(expenses) fără metodă rămâne fără metodă, nu se defaultează la cash', () => {
  const normalized = normalizeRecord('expenses', { id: 'EXP-1', date: '2026-09-01', amount: 100 });
  assert.equal('method' in normalized, false);
});

test('normalizeRecord(payments) respinge o monedă necunoscută', () => {
  assert.throws(
    () =>
      normalizeRecord('payments', {
        id: 'P-1',
        date: '2026-09-15',
        amount: 500,
        method: 'Cash',
        currency: 'USD',
      }),
    /monedă/i,
  );
});
