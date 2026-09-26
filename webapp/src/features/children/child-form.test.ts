import { describe, expect, it } from 'vitest';
import { buildChildRecord, defaultChildFormValues, type ChildFormValues } from './child-form';
import type { Child } from '@contracts/record-types.mjs';

describe('defaultChildFormValues', () => {
  it('pentru un copil nou, luna implicită e cea a începerii frecventării', () => {
    const values = defaultChildFormValues(null, '2026-09-24');
    expect(values.statusFrom).toBe('2026-09');
    expect(values.status).toBe('Activ');
    expect(values.dueDay).toBe('10');
    expect(values.fee).toBe('');
  });

  it('pentru un copil existent fără istoric, luna implicită vine din data începerii frecventării', () => {
    const child = {
      attendanceDate: '2026-01-10',
      contractDate: null,
      feeHistory: [],
      statusHistory: [],
    } as unknown as Child;
    const values = defaultChildFormValues(child, '2026-09-24');
    expect(values.statusFrom).toBe('2026-01');
  });

  it('pentru un copil cu istoric deja existent, luna implicită e luna curentă', () => {
    const child = {
      attendanceDate: '2026-01-10',
      feeHistory: [{ from: '2026-01', amount: 1000 }],
      statusHistory: [],
    } as unknown as Child;
    const values = defaultChildFormValues(child, '2026-09-24');
    expect(values.statusFrom).toBe('2026-09');
  });

  it('serializează istoricul existent ca text "lună = valoare"', () => {
    const child = {
      feeHistory: [{ from: '2026-01', amount: 1000 }],
      statusHistory: [{ from: '2026-01', status: 'Activ' }],
    } as unknown as Child;
    const values = defaultChildFormValues(child, '2026-09-24');
    expect(values.feeHistoryText).toBe('2026-01 = 1000');
    expect(values.statusHistoryText).toBe('2026-01 = Activ');
  });
});

describe('buildChildRecord', () => {
  const baseValues = {
    name: 'Andrei Popescu',
    birthDate: '2020-05-01',
    status: 'Activ',
    groupId: '',
    parent: 'Maria Popescu',
    phone: '0722000000',
    parent2: '',
    phone2: '',
    healthNotes: '',
    contractDate: '2026-01-05',
    attendanceDate: '2026-01-10',
    withdrawalDate: '',
    statusFrom: '2026-01',
    fee: '1500',
    feeFrom: '2026-01',
    dueDay: '10',
    feeHistoryText: '',
    statusHistoryText: '',
    notes: '',
  };

  it('la creare, seedează istoricul de taxă și de statut din valorile completate', () => {
    const record = buildChildRecord(null, 'ID-1', baseValues);
    expect(record.id).toBe('ID-1');
    expect(record.feeHistory).toEqual([{ from: '2026-01', amount: 1500, currency: 'MDL' }]);
    expect(record.statusHistory).toEqual([{ from: '2026-01', status: 'Activ' }]);
    expect(record.groupId).toBeNull();
  });

  // La editare reală, formularul se deschide cu istoricul deja serializat în
  // textarea (defaultChildFormValues) — testele simulează exact acea reeditare,
  // nu un formular gol, ca la creare.
  function reopenedValues(previous: Child): ChildFormValues {
    return defaultChildFormValues(previous, '2026-09-24');
  }

  it('taxa schimbată la editare adaugă o intrare nouă de istoric, la luna aleasă', () => {
    const previous = buildChildRecord(null, 'ID-1', baseValues);
    const record = buildChildRecord(previous, 'ID-1', {
      ...reopenedValues(previous),
      fee: '1800',
      feeFrom: '2026-09',
    });
    expect(record.feeHistory).toEqual([
      { from: '2026-01', amount: 1500, currency: 'MDL' },
      { from: '2026-09', amount: 1800, currency: 'MDL' },
    ]);
  });

  it('taxa neschimbată la editare nu adaugă o intrare nouă', () => {
    const previous = buildChildRecord(null, 'ID-1', baseValues);
    const record = buildChildRecord(previous, 'ID-1', { ...reopenedValues(previous), feeFrom: '2026-09' });
    expect(record.feeHistory).toEqual([{ from: '2026-01', amount: 1500, currency: 'MDL' }]);
  });

  it('statutul schimbat adaugă o intrare de istoric la luna aleasă', () => {
    const previous = buildChildRecord(null, 'ID-1', baseValues);
    const record = buildChildRecord(previous, 'ID-1', {
      ...reopenedValues(previous),
      status: 'Suspendat',
      statusFrom: '2026-09',
    });
    expect(record.statusHistory).toEqual([
      { from: '2026-01', status: 'Activ' },
      { from: '2026-09', status: 'Suspendat' },
    ]);
  });

  it('istoricul completat manual, cu format invalid, aruncă o eroare în română', () => {
    expect(() => buildChildRecord(null, 'ID-1', { ...baseValues, feeHistoryText: '2026-01' })).toThrow(
      'Istoric invalid. Folosește formatul lună = valoare.',
    );
  });

  it('taxă goală înseamnă necunoscută (null), fără intrare de istoric', () => {
    const record = buildChildRecord(null, 'ID-1', { ...baseValues, fee: '' });
    expect(record.fee).toBeNull();
    expect(record.feeHistory).toEqual([]);
  });
});
