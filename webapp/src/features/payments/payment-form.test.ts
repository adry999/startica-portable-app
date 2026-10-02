import { describe, expect, it, vi } from 'vitest';
import {
  buildPaymentRecord,
  buildSiblingPaymentRecords,
  createPaymentUndo,
  defaultPaymentFormValues,
  findDuplicatePayment,
  paymentUndoDetail,
  tenderMethodsFor,
  totalOfTenders,
} from './payment-form';
import type { Payment, RecordsSnapshot } from '@contracts/record-types.mjs';

describe('defaultPaymentFormValues', () => {
  it('pentru o plată nouă, seedează un singur rând de alocare la luna datei', () => {
    const values = defaultPaymentFormValues(null, '2026-09-24');
    expect(values.date).toBe('2026-09-24');
    expect(values.allocations).toMatchObject([{ month: '2026-09', amount: '' }]);
    expect(values.tenders).toEqual({ Cash: '', Card: '', Transfer: '' });
  });

  it('pentru o plată existentă, preia tenders și alocările din payment', () => {
    const payment = {
      childId: 'c1',
      date: '2026-08-10',
      tenders: [{ method: 'Cash', amount: 500 }],
      allocations: [{ month: '2026-08', amount: 500 }],
      sourceName: '',
      childName: '',
      reviewed: false,
      notes: '',
    } as unknown as Payment;
    const values = defaultPaymentFormValues(payment, '2026-09-24');
    expect(values.tenders.Cash).toBe('500');
    expect(values.allocations).toMatchObject([{ month: '2026-08', amount: '500' }]);
  });

  it('F7 (FEEDBACK-01-10.md): cu defaultChildId, luna rămâne cea a datei plății, nu restanța copilului', () => {
    const records = {
      children: [
        {
          id: 'c1',
          attendanceDate: '2026-01-10',
          statusHistory: [{ from: '2026-01', status: 'Activ' }],
          feeHistory: [{ from: '2026-01', amount: 1500 }],
        },
      ],
      payments: [],
    } as unknown as RecordsSnapshot;

    const values = defaultPaymentFormValues(null, '2026-09-24', 'c1', records);
    expect(values.allocations[0].month).toBe('2026-09');
  });

  it('15b: sendSmsConfirmation implicit bifat doar dacă părintele are telefon valid', () => {
    const records = {
      children: [
        { id: 'c1', name: 'Ion', parent: 'Maria', phone: '069123456' },
        { id: 'c2', name: 'Andrei', parent: 'Vasile', phone: '' },
      ],
      payments: [],
    } as unknown as RecordsSnapshot;

    expect(defaultPaymentFormValues(null, '2026-09-24', 'c1', records).sendSmsConfirmation).toBe(true);
    expect(defaultPaymentFormValues(null, '2026-09-24', 'c2', records).sendSmsConfirmation).toBe(false);
    expect(defaultPaymentFormValues(null, '2026-09-24').sendSmsConfirmation).toBe(false);
  });
});

describe('tenderMethodsFor', () => {
  it('B1: nu mai oferă în SegmentedControl o metodă în afara Cash/Card/Transfer', () => {
    const payment = { tenders: [{ method: 'Revolut', amount: 100 }] } as unknown as Payment;
    expect(tenderMethodsFor(payment)).toEqual(['Cash', 'Card', 'Transfer']);
  });
});

describe('totalOfTenders', () => {
  it('însumează metodele completate, ignoră cele goale', () => {
    expect(totalOfTenders({ Cash: '500', Card: '', Transfer: '300.50' })).toBe(800.5);
  });
});

describe('buildPaymentRecord', () => {
  const baseValues = {
    childId: 'c1',
    date: '2026-09-10',
    service: 'gradinita',
    tenders: { Cash: '1500', Card: '', Transfer: '' },
    sourceName: '',
    reviewed: false,
    allocations: [{ month: '2026-09', amount: '1500' }],
    notes: '',
    sendSmsConfirmation: false,
    siblings: [],
  };

  it('calculează suma și metoda din tenders, ignorând amount-ul trimis', () => {
    const record = buildPaymentRecord(null, 'PAY-1', baseValues);
    expect(record.amount).toBe(1500);
    expect(record.method).toBe('Cash');
    expect(record.tenders).toEqual([{ method: 'Cash', amount: 1500 }]);
  });

  it('tenders pe mai multe metode se combină în suma și metoda finală', () => {
    const record = buildPaymentRecord(null, 'PAY-1', {
      ...baseValues,
      tenders: { Cash: '500', Card: '1000', Transfer: '' },
    });
    expect(record.amount).toBe(1500);
    expect(record.method).toBe('Cash + Card');
  });

  it('repartizări care depășesc suma plății aruncă eroare', () => {
    expect(() =>
      buildPaymentRecord(null, 'PAY-1', { ...baseValues, allocations: [{ month: '2026-09', amount: '2000' }] }),
    ).toThrow('Repartizările depășesc suma plății.');
  });

  it('fără nicio metodă completată aruncă eroare', () => {
    expect(() =>
      buildPaymentRecord(null, 'PAY-1', { ...baseValues, tenders: { Cash: '', Card: '', Transfer: '' } }),
    ).toThrow();
  });
});

describe('buildSiblingPaymentRecords (44b)', () => {
  const baseValues = {
    childId: 'c1',
    date: '2026-09-10',
    service: 'gradinita',
    tenders: { Cash: '1500', Card: '', Transfer: '' },
    sourceName: '',
    reviewed: false,
    allocations: [{ month: '2026-09', amount: '1500' }],
    notes: '',
    sendSmsConfirmation: false,
    siblings: [],
  };

  it('gol fără frați sau fără receiptGroupId', () => {
    expect(buildSiblingPaymentRecords(baseValues)).toEqual([]);
    expect(
      buildSiblingPaymentRecords({ ...baseValues, siblings: [{ childId: 'c2', month: '2026-09', amount: '500' }] }),
    ).toEqual([]);
  });

  it('câte un Payment pe frate bifat, cu același receiptGroupId și metoda plății principale', () => {
    const records = buildSiblingPaymentRecords({
      ...baseValues,
      receiptGroupId: 'GRP-1',
      siblings: [
        { childId: 'c2', month: '2026-09', amount: '500' },
        { childId: 'c3', month: '2026-08', amount: '300' },
      ],
    });
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      childId: 'c2',
      date: '2026-09-10',
      service: 'gradinita',
      amount: 500,
      method: 'Cash',
      receiptGroupId: 'GRP-1',
      allocations: [{ month: '2026-09', amount: 500 }],
    });
    expect(records[1]).toMatchObject({ childId: 'c3', receiptGroupId: 'GRP-1', amount: 300 });
    expect(records[0].id).not.toBe(records[1].id);
  });

  it('ignoră rândurile cu sumă zero sau negativă', () => {
    const records = buildSiblingPaymentRecords({
      ...baseValues,
      receiptGroupId: 'GRP-1',
      siblings: [{ childId: 'c2', month: '2026-09', amount: '0' }],
    });
    expect(records).toEqual([]);
  });
});

describe('paymentUndoDetail (40b §5)', () => {
  const records = {
    children: [
      { id: 'c1', name: 'Andrei Popescu' },
      { id: 'c2', name: 'Radu Popescu' },
    ],
  } as unknown as RecordsSnapshot;
  const baseValues = {
    childId: 'c1',
    date: '2026-09-10',
    service: 'gradinita',
    tenders: { Cash: '1500', Card: '', Transfer: '' },
    sourceName: '',
    reviewed: false,
    allocations: [{ month: '2026-09', amount: '1500' }],
    notes: '',
    sendSmsConfirmation: false,
    siblings: [],
  };

  it('fără frați: suma plății principale și numele copilului', () => {
    expect(paymentUndoDetail(baseValues, records)).toBe('1.500,00 lei · Andrei Popescu');
  });

  it('44b: cu frați bifați, adaugă suma lor la total și „+ N frați”', () => {
    const detail = paymentUndoDetail(
      { ...baseValues, siblings: [{ childId: 'c2', month: '2026-09', amount: '500' }] },
      records,
    );
    expect(detail).toBe('2.000,00 lei · Andrei Popescu + 1 frate');
  });

  it('44b: ignoră frații cu sumă zero/negativă la numărătoare și la total', () => {
    const detail = paymentUndoDetail(
      { ...baseValues, siblings: [{ childId: 'c2', month: '2026-09', amount: '0' }] },
      records,
    );
    expect(detail).toBe('1.500,00 lei · Andrei Popescu');
  });
});

describe('createPaymentUndo (40b §5, Grup frați 44b)', () => {
  it('cu un singur auditId, cheamă /api/undo o dată', async () => {
    const mutate = vi.fn().mockResolvedValue({});
    await createPaymentUndo([9001], mutate)();
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith('/api/undo', { auditId: 9001 });
  });

  it('cu mai multe auditId-uri, cheamă /api/undo o dată per id, independent', async () => {
    const mutate = vi.fn().mockResolvedValue({});
    await createPaymentUndo([9001, 9002, 9003], mutate)();
    expect(mutate).toHaveBeenCalledTimes(3);
    for (const auditId of [9001, 9002, 9003]) expect(mutate).toHaveBeenCalledWith('/api/undo', { auditId });
  });

  it('dacă unul eșuează, restul tot se anulează, dar aruncă o eroare care spune câte au mers', async () => {
    const mutate = vi.fn((_path: string, body: Record<string, unknown>) =>
      body.auditId === 9002 ? Promise.reject(new Error('S-a modificat între timp.')) : Promise.resolve({}),
    );
    await expect(createPaymentUndo([9001, 9002, 9003], mutate)()).rejects.toThrow(
      'Anulat 2 din 3 achitări — 1 nu a putut fi anulată (S-a modificat între timp.).',
    );
    // Toate cele 3 au fost încercate (independent), nu doar primele până la eroare.
    expect(mutate).toHaveBeenCalledTimes(3);
  });

  it('cu mai multe eșecuri, numără corect câte nu au putut fi anulate', async () => {
    const mutate = vi.fn((_path: string, body: Record<string, unknown>) =>
      body.auditId === 9001 ? Promise.resolve({}) : Promise.reject(new Error('Nu există.')),
    );
    await expect(createPaymentUndo([9001, 9002, 9003], mutate)()).rejects.toThrow(
      'Anulat 1 din 3 achitări — 2 nu au putut fi anulate (Nu există.).',
    );
  });
});

describe('findDuplicatePayment', () => {
  const records = {
    payments: [
      { id: 'p1', childId: 'c1', date: '2026-09-10', amount: 1500, method: 'Cash', archived: false },
      { id: 'p2', childId: 'c1', date: '2026-09-10', amount: 1500, method: 'Cash', archived: true },
    ],
  } as unknown as RecordsSnapshot;

  it('găsește o plată neasrhivată cu același copil/dată/sumă/metodă', () => {
    const candidate = { childId: 'c1', date: '2026-09-10', amount: 1500, method: 'Cash' } as Payment;
    expect(findDuplicatePayment(records, candidate)?.id).toBe('p1');
  });

  it('ignoră plățile arhivate și pe cele cu o sumă diferită', () => {
    const differentAmount = { childId: 'c1', date: '2026-09-10', amount: 999, method: 'Cash' } as Payment;
    expect(findDuplicatePayment(records, differentAmount)).toBeNull();
  });

  it('B1: recunoaște duplicatul unei plăți mixte indiferent de ordinea metodelor', () => {
    const mixedRecords = {
      payments: [
        {
          id: 'p3',
          childId: 'c1',
          date: '2026-09-10',
          amount: 200,
          method: 'Cash + Card',
          tenders: [
            { method: 'Cash', amount: 120 },
            { method: 'Card', amount: 80 },
          ],
          archived: false,
        },
      ],
    } as unknown as RecordsSnapshot;
    const candidate = {
      childId: 'c1',
      date: '2026-09-10',
      amount: 200,
      method: 'Card + Cash',
      tenders: [
        { method: 'Card', amount: 80 },
        { method: 'Cash', amount: 120 },
      ],
    } as Payment;
    expect(findDuplicatePayment(mixedRecords, candidate)?.id).toBe('p3');
  });
});
