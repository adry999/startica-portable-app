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
    [{ method: 'Mixtă', amount: 100 }],
  ])
    assert.throws(() => normalizeRecord('payments', { ...mixedPayment, tenders }));
  // B1: alias-urile cunoscute (fără diacritice/case) se normalizează, nu se resping.
  const normalizedMethod = normalizeRecord('payments', {
    ...mixedPayment,
    tenders: [{ method: 'numerar', amount: 1500.3 }],
  });
  assert.equal(normalizedMethod.method, 'Cash');
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
      notes: [{ id: 'NOTE-1', text: 'observatii', date: '2024-12-02' }],
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

test('§10: un copil normalizează phone/phone2 la E.164, fără phoneInvalid', () => {
  const record = normalizeRecord('children', { ...child(), phone: '069123456', phone2: '0 80 123 456' });
  assert.equal(record.phone, '+37369123456');
  assert.equal(record.phone2, '+37380123456');
  assert.ok(!('phoneInvalid' in record));
  assert.ok(!('phone2Invalid' in record));
});

test('§10: „alt număr" (prefix +, nu moldovenesc) se salvează cum a fost scris, fără marcaj', () => {
  const record = normalizeRecord('children', { ...child(), phone: '+40 721 000 000' });
  assert.equal(record.phone, '+40 721 000 000');
  assert.ok(!('phoneInvalid' in record));
});

test('§10: un telefon invalid, fără „+", rămâne cum a fost scris, cu phoneInvalid: true', () => {
  const record = normalizeRecord('children', { ...child(), phone: '123', phone2: 'nu e telefon' });
  assert.equal(record.phone, '123');
  assert.equal(record.phoneInvalid, true);
  assert.equal(record.phone2, 'nu e telefon');
  assert.equal(record.phone2Invalid, true);
});

test('§10: re-salvarea unui telefon corectat șterge phoneInvalid', () => {
  const withInvalid = normalizeRecord('children', { ...child(), phone: '123' });
  assert.equal(withInvalid.phoneInvalid, true);
  const fixed = normalizeRecord('children', { ...withInvalid, phone: '069123456' });
  assert.equal(fixed.phone, '+37369123456');
  assert.ok(!('phoneInvalid' in fixed));
});

test('§10: o fișă fără phone2 nu primește phone2/phone2Invalid din senin', () => {
  const record = normalizeRecord('children', { ...child() });
  assert.equal(record.phone2, undefined);
  assert.ok(!('phone2Invalid' in record));
});

test('§10: persoanele autorizate să ridice copilul au telefonul normalizat la E.164', () => {
  const record = normalizeRecord('children', {
    ...child(),
    pickupPersons: [{ name: 'Bunica', phone: '069123456' }],
  });
  assert.equal(record.pickupPersons[0].phone, '+37369123456');
});

test('§10: o vizită normalizează phone/phone2 la fel ca un copil', () => {
  const record = normalizeRecord('visits', { ...visit(), phone: '069123456', phone2: '123' });
  assert.equal(record.phone, '+37369123456');
  assert.ok(!('phoneInvalid' in record));
  assert.equal(record.phone2, '123');
  assert.equal(record.phone2Invalid, true);
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

test('normalizeRecord(children) recalculează name din lastName+firstName când ambele sunt trimise', () => {
  const record = normalizeRecord('children', { ...child(), firstName: ' Maria ', lastName: ' Popescu ' });
  assert.equal(record.name, 'Popescu Maria');
  assert.equal(record.firstName, 'Maria');
  assert.equal(record.lastName, 'Popescu');
});

test('normalizeRecord(children) nu atinge name când e trimis un singur câmp firstName/lastName (fișă veche)', () => {
  const record = normalizeRecord('children', { ...child(), name: 'Nume Vechi', firstName: 'Ion' });
  assert.equal(record.name, 'Nume Vechi');
  assert.equal(record.firstName, 'Ion');
  assert.equal(normalizeRecord('children', child()).firstName, undefined);
  assert.equal(normalizeRecord('children', child()).lastName, undefined);
});

test('normalizeRecord(children) validează IDNP-ul ca exact 13 cifre, tratând golul ca absent', () => {
  const withIdnp = normalizeRecord('children', { ...child(), idnp: '2001234567890' });
  assert.equal(withIdnp.idnp, '2001234567890');
  assert.throws(() => normalizeRecord('children', { ...child(), idnp: '123' }), /IDNP/);
  assert.throws(() => normalizeRecord('children', { ...child(), idnp: 'abcdefghijklm' }), /IDNP/);
  assert.equal(normalizeRecord('children', { ...child(), idnp: '' }).idnp, undefined);
  assert.equal(normalizeRecord('children', child()).idnp, undefined);
});

test('children.address trece prin normalizare ca orice câmp text opțional, trimmed', () => {
  const withAddress = normalizeRecord('children', { ...child(), address: '  Str. Ștefan cel Mare 1  ' });
  assert.equal(withAddress.address, 'Str. Ștefan cel Mare 1');
  assert.equal(normalizeRecord('children', child()).address, undefined);
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

test('normalizeRecord(payments) acceptă fxRate/amountEur valide', () => {
  const record = normalizeRecord('payments', {
    id: 'P-1',
    date: '2026-09-15',
    amount: 3000,
    method: 'Cash',
    fxRate: 19.62,
    amountEur: 152.91,
  });
  assert.equal(record.fxRate, 19.62);
  assert.equal(record.amountEur, 152.91);
});

test('normalizeRecord(payments) respinge un fxRate invalid', () => {
  assert.throws(
    () => normalizeRecord('payments', { id: 'P-1', date: '2026-09-15', amount: 3000, method: 'Cash', fxRate: 0 }),
    /Curs invalid/,
  );
  assert.throws(
    () => normalizeRecord('payments', { id: 'P-1', date: '2026-09-15', amount: 3000, method: 'Cash', fxRate: -5 }),
    /Curs invalid/,
  );
});

test('normalizeRecord(payments) fără fxRate/amountEur rămâne fără ele, nu se defaultează', () => {
  const record = normalizeRecord('payments', {
    id: 'P-1',
    date: '2026-09-15',
    amount: 500,
    method: 'Cash',
  });
  assert.equal('fxRate' in record, false);
  assert.equal('amountEur' in record, false);
});

test('normalizeRecord(payments) acceptă roundingDiff pozitiv sau negativ', () => {
  const surplus = normalizeRecord('payments', {
    id: 'P-1',
    date: '2026-09-15',
    amount: 1000.17,
    method: 'Cash',
    roundingDiff: 0.17,
  });
  assert.equal(surplus.roundingDiff, 0.17);

  const lipsa = normalizeRecord('payments', {
    id: 'P-2',
    date: '2026-09-15',
    amount: 998.17,
    method: 'Cash',
    roundingDiff: -1.83,
  });
  assert.equal(lipsa.roundingDiff, -1.83);
});

test('normalizeRecord(payments) respinge un roundingDiff nevalid', () => {
  assert.throws(
    () =>
      normalizeRecord('payments', {
        id: 'P-1',
        date: '2026-09-15',
        amount: 1000,
        method: 'Cash',
        roundingDiff: Number.NaN,
      }),
    /Diferența de rotunjire este invalidă/,
  );
});

test('normalizeRecord(payments) fără roundingDiff rămâne fără el, nu se defaultează', () => {
  const record = normalizeRecord('payments', {
    id: 'P-1',
    date: '2026-09-15',
    amount: 500,
    method: 'Cash',
  });
  assert.equal('roundingDiff' in record, false);
});

test('normalizeRecord(payments) acceptă fxRateSource bnm sau manual', () => {
  const bnm = normalizeRecord('payments', {
    id: 'P-1',
    date: '2026-09-15',
    amount: 3000,
    method: 'Cash',
    fxRate: 19.74,
    fxRateSource: 'bnm',
  });
  assert.equal(bnm.fxRateSource, 'bnm');
  const manual = normalizeRecord('payments', {
    id: 'P-2',
    date: '2026-09-15',
    amount: 3000,
    method: 'Cash',
    fxRate: 19.8,
    fxRateSource: 'manual',
  });
  assert.equal(manual.fxRateSource, 'manual');
});

test('normalizeRecord(payments) respinge un fxRateSource necunoscut', () => {
  assert.throws(
    () =>
      normalizeRecord('payments', {
        id: 'P-1',
        date: '2026-09-15',
        amount: 3000,
        method: 'Cash',
        fxRate: 19.74,
        fxRateSource: 'ghicit',
      }),
    /Proveniența cursului este invalidă/,
  );
});

test('normalizeRecord(payments) acceptă receiptNumber valid', () => {
  const record = normalizeRecord('payments', {
    id: 'P-1',
    date: '2026-09-15',
    amount: 3000,
    method: 'Cash',
    receiptNumber: 7,
  });
  assert.equal(record.receiptNumber, 7);
});

test('normalizeRecord(payments) fără receiptNumber rămâne fără el, nu se defaultează', () => {
  const record = normalizeRecord('payments', { id: 'P-1', date: '2026-09-15', amount: 500, method: 'Cash' });
  assert.equal('receiptNumber' in record, false);
});

test('normalizeRecord(payments) respinge un receiptNumber invalid', () => {
  for (const receiptNumber of [0, -1, 1.5, '7'])
    assert.throws(
      () => normalizeRecord('payments', { id: 'P-1', date: '2026-09-15', amount: 3000, method: 'Cash', receiptNumber }),
      /confirmării de plată este invalid/,
    );
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

test('grupa acceptă un singur principal în echipă', () => {
  assert.throws(
    () =>
      normalizeRecord('groups', {
        id: 'GRP-1',
        name: 'Grupa mare',
        team: [
          { staffId: 'STF-1', role: 'principal' },
          { staffId: 'STF-2', role: 'principal' },
        ],
      }),
    /un singur membru principal/,
  );
  const group = normalizeRecord('groups', {
    id: 'GRP-1',
    name: 'Grupa mare',
    team: [
      { staffId: 'STF-1', role: 'principal' },
      { staffId: 'STF-2', role: 'asistent', days: [1, 3, 5] },
    ],
  });
  assert.equal(group.team.length, 2);
  assert.deepEqual(group.team[1].days, [1, 3, 5]);
});

test('grupa acceptă order, tone și interval de vârstă (03-grupe.md v2)', () => {
  const group = normalizeRecord('groups', {
    id: 'GRP-1',
    name: 'Grupa mare',
    order: 2,
    tone: 'teal',
    ageMinYears: 3,
    ageMaxYears: 5,
  });
  assert.equal(group.order, 2);
  assert.equal(group.tone, 'teal');
  assert.equal(group.ageMinYears, 3);
  assert.equal(group.ageMaxYears, 5);

  assert.throws(() => normalizeRecord('groups', { id: 'GRP-1', name: 'Grupa mare', order: -1 }), /Ordinea grupei/);
  assert.throws(
    () => normalizeRecord('groups', { id: 'GRP-1', name: 'Grupa mare', ageMinYears: 6, ageMaxYears: 3 }),
    /vârsta minimă/i,
  );
});

test('grupa fără echipă are team gol, iar un rol sau o zi necunoscută sunt respinse', () => {
  const group = normalizeRecord('groups', { id: 'GRP-1', name: 'Grupa mare' });
  assert.deepEqual(group.team, []);
  assert.throws(
    () =>
      normalizeRecord('groups', {
        id: 'GRP-1',
        name: 'Grupa mare',
        team: [{ staffId: 'STF-1', role: 'sef' }],
      }),
    /Rol de echipă invalid/,
  );
  assert.throws(
    () =>
      normalizeRecord('groups', {
        id: 'GRP-1',
        name: 'Grupa mare',
        team: [{ staffId: 'STF-1', role: 'principal', days: [0, 6] }],
      }),
    /Zilele din echipa grupei/,
  );
});

test('copilul fără notes primește listă goală', () => {
  assert.deepEqual(child().notes, []);
});

test('copilul acceptă o listă de note, sortată cu cea mai recentă primul rând', () => {
  const normalized = normalizeRecord('children', {
    ...child(),
    notes: [
      { id: 'NOTE-1', text: 'veche', date: '2026-01-01' },
      { id: 'NOTE-2', text: 'nouă', date: '2026-09-01' },
    ],
  });
  assert.deepEqual(normalized.notes, [
    { id: 'NOTE-2', text: 'nouă', date: '2026-09-01' },
    { id: 'NOTE-1', text: 'veche', date: '2026-01-01' },
  ]);
});

test('o notă fără id primește unul generat', () => {
  const normalized = normalizeRecord('children', { ...child(), notes: [{ text: 'fără id', date: '2026-09-01' }] });
  assert.equal(normalized.notes.length, 1);
  assert.ok(normalized.notes[0].id);
  assert.equal(normalized.notes[0].text, 'fără id');
});

test('notes respinge un id repetat, un text gol sau o dată invalidă', () => {
  assert.throws(
    () =>
      normalizeRecord('children', {
        ...child(),
        notes: [
          { id: 'NOTE-1', text: 'a', date: '2026-09-01' },
          { id: 'NOTE-1', text: 'b', date: '2026-09-02' },
        ],
      }),
    /Notă: id repetat/,
  );
  assert.throws(
    () => normalizeRecord('children', { ...child(), notes: [{ id: 'NOTE-1', text: '', date: '2026-09-01' }] }),
    /Text notă/,
  );
  assert.throws(
    () => normalizeRecord('children', { ...child(), notes: [{ id: 'NOTE-1', text: 'a', date: 'nu e dată' }] }),
    /Notă: dată invalidă/,
  );
});

test('notes respinge o valoare care nu e listă (format vechi, text liber, netrecut prin migrare)', () => {
  assert.throws(() => normalizeRecord('children', { ...child(), notes: 'text vechi' }), /Note: listă invalidă/);
});

test('A3: o notă acceptă autor, dată de editare și ștergere soft', () => {
  const normalized = normalizeRecord('children', {
    ...child(),
    notes: [
      { id: 'NOTE-1', text: 'a', date: '2026-09-01', author: 'Ala (Recepție)', updatedAt: '2026-09-02T10:00:00.000Z' },
    ],
  });
  assert.equal(normalized.notes[0].author, 'Ala (Recepție)');
  assert.equal(normalized.notes[0].updatedAt, '2026-09-02T10:00:00.000Z');

  const deleted = normalizeRecord('children', {
    ...child(),
    notes: [{ id: 'NOTE-1', text: 'a', date: '2026-09-01', deletedAt: '2026-09-03T10:00:00.000Z' }],
  });
  assert.equal(deleted.notes[0].deletedAt, '2026-09-03T10:00:00.000Z');

  assert.throws(
    () =>
      normalizeRecord('children', {
        ...child(),
        notes: [{ id: 'NOTE-1', text: 'a', date: '2026-09-01', updatedAt: 'nu e dată' }],
      }),
    /Notă: dată de editare invalidă/,
  );
});

test('A2/A3: parentRelation, parent2Relation și pickupPersons', () => {
  const normalized = normalizeRecord('children', {
    ...child(),
    parentRelation: 'Mamă',
    parent2Relation: 'Tată',
    pickupPersons: [{ name: ' Bunica Maria ', relation: 'Bunică', note: 'marți, joi' }],
  });
  assert.equal(normalized.parentRelation, 'Mamă');
  assert.equal(normalized.parent2Relation, 'Tată');
  assert.equal(normalized.pickupPersons.length, 1);
  assert.equal(normalized.pickupPersons[0].name, 'Bunica Maria');
  assert.ok(normalized.pickupPersons[0].id);
});

test('pickupPersons respinge un nume gol sau mai mult de 10 persoane', () => {
  assert.throws(
    () => normalizeRecord('children', { ...child(), pickupPersons: [{ name: '' }] }),
    /Nume persoană autorizată/,
  );
  assert.throws(
    () =>
      normalizeRecord('children', {
        ...child(),
        pickupPersons: Array.from({ length: 11 }, (_, i) => ({ name: `Persoana ${i}` })),
      }),
    /Persoane autorizate: listă invalidă/,
  );
});

const payerAlias = () =>
  normalizeRecord('payerAliases', {
    id: 'PAY-ALIAS-test',
    alias: 'Ion Popescu IBAN MD00XYZ',
    childId: 'ID-test',
    createdAt: '2026-09-25T10:00:00.000Z',
  });

test('payerAliases (plătitor reținut) se normalizează cu alias, copil și dată valide', () => {
  const normalized = payerAlias();
  assert.equal(normalized.alias, 'Ion Popescu IBAN MD00XYZ');
  assert.equal(normalized.childId, 'ID-test');
  assert.equal(normalized.createdAt, '2026-09-25T10:00:00.000Z');
  // Alias-ul se scrie tale-quale — doar spațiile de la capete se elimină.
  assert.equal(normalizeRecord('payerAliases', { ...payerAlias(), alias: '  Cu spații  ' }).alias, 'Cu spații');
});

test('payerAliases respinge un alias lipsă sau gol', () => {
  assert.throws(() => normalizeRecord('payerAliases', { ...payerAlias(), alias: undefined }), /Plătitor/);
  assert.throws(() => normalizeRecord('payerAliases', { ...payerAlias(), alias: '   ' }), /Plătitor/);
});

test('payerAliases respinge un childId lipsă sau invalid', () => {
  assert.throws(() => normalizeRecord('payerAliases', { ...payerAlias(), childId: undefined }), /ID copil/);
  assert.throws(
    () => normalizeRecord('payerAliases', { ...payerAlias(), childId: 'cu spații nu e permis' }),
    /ID copil invalid/,
  );
});

test('payerAliases respinge o dată de creare lipsă sau invalidă', () => {
  assert.throws(() => normalizeRecord('payerAliases', { ...payerAlias(), createdAt: undefined }), /creării/);
  assert.throws(() => normalizeRecord('payerAliases', { ...payerAlias(), createdAt: 'nu e dată' }), /creării/);
});

test('validateState acceptă un plătitor reținut legat de un copil existent', () => {
  const state = validateState({
    children: [child()],
    payments: [],
    expenses: [],
    groups: [],
    categories: [],
    visits: [],
    payerAliases: [payerAlias()],
  });
  assert.equal(state.payerAliases.length, 1);
  assert.equal(state.payerAliases[0].alias, 'Ion Popescu IBAN MD00XYZ');
});

// Precedentul e `charges` (Bazin, 2026-09-27): un backup sau export dinainte ca acest tip să
// existe nu trebuie să blocheze reimportul — lista lipsă devine [], nu o eroare.
test('validateState acceptă un instantaneu fără payerAliases și îl implicitează la listă goală', () => {
  const state = validateState({
    children: [child()],
    payments: [],
    expenses: [],
    groups: [],
    categories: [],
    visits: [],
  });
  assert.deepEqual(state.payerAliases, []);
});

// Spre deosebire de `charges`, un alias orfan (copilul a fost șters ulterior) nu blochează
// validateState() — e o comoditate de sugestie, nu o înregistrare financiară.
test('validateState nu respinge un plătitor reținut al cărui copil nu mai există', () => {
  const state = validateState({
    children: [],
    payments: [],
    expenses: [],
    groups: [],
    categories: [],
    visits: [],
    payerAliases: [payerAlias()],
  });
  assert.equal(state.payerAliases.length, 1);
});
