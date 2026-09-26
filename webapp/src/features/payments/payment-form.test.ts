import { describe, expect, it } from 'vitest';
import {
  buildPaymentRecord,
  defaultPaymentFormValues,
  findDuplicatePayment,
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

  it('cu defaultChildId și records, propune luna cea mai veche neachitată a copilului', () => {
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
    expect(values.allocations[0].month).toBe('2026-01');
  });
});

describe('tenderMethodsFor', () => {
  it('include metoda existentă chiar dacă nu e Cash/Card/Transfer', () => {
    const payment = { tenders: [{ method: 'Revolut', amount: 100 }] } as unknown as Payment;
    expect(tenderMethodsFor(payment)).toEqual(['Cash', 'Card', 'Transfer', 'Revolut']);
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
    tenders: { Cash: '1500', Card: '', Transfer: '' },
    sourceName: '',
    reviewed: false,
    allocations: [{ month: '2026-09', amount: '1500' }],
    notes: '',
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
});
