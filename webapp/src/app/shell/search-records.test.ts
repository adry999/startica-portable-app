import { describe, expect, it } from 'vitest';
import { searchRecords } from './search-records';
import type { RecordsSnapshot } from '@contracts/record-types.mjs';

const records = {
  children: [
    { id: 'c1', name: 'Andrei Popescu', parent: 'Maria Popescu', contractNumber: '7', archived: false },
    { id: 'c2', name: 'Maria Ionescu', parent: 'Ioana Ionescu', contractNumber: '12', archived: false },
    { id: 'c3', name: 'Andrei Vechi', parent: '', contractNumber: '3', archived: true },
  ],
  payments: [
    {
      id: 'p1',
      childId: '',
      sourceName: 'Andrei P.',
      date: '2026-09-10',
      amount: 500,
      archived: false,
    },
    {
      id: 'p2',
      childId: 'c2',
      sourceName: '',
      date: '2026-09-05',
      amount: 1200,
      archived: false,
    },
    {
      id: 'p3',
      childId: '',
      sourceName: 'Andrei arhivat',
      date: '2026-09-01',
      amount: 300,
      archived: true,
    },
  ],
  expenses: [],
  groups: [],
  categories: [],
  visits: [],
} as unknown as RecordsSnapshot;

describe('searchRecords', () => {
  it('un query gol nu întoarce niciun rezultat', () => {
    expect(searchRecords(records, '')).toEqual([]);
    expect(searchRecords(records, '   ')).toEqual([]);
  });

  it('găsește copiii nearhivați după nume, fără diacritice și case-insensitive', () => {
    const results = searchRecords(records, 'andREi');
    const childIds = results.filter(r => r.type === 'children').map(r => r.id);
    expect(childIds).toEqual(['c1']); // c3 e arhivat, exclus
  });

  it('găsește după numărul contractului sau numele părintelui', () => {
    expect(searchRecords(records, '12').some(r => r.type === 'children' && r.id === 'c2')).toBe(true);
    expect(searchRecords(records, 'Ioana').some(r => r.type === 'children' && r.id === 'c2')).toBe(true);
  });

  it('găsește achitările nearhivate după numele din sursă sau al copilului asociat', () => {
    const results = searchRecords(records, 'andrei');
    const paymentIds = results.filter(r => r.type === 'payments').map(r => r.id);
    expect(paymentIds).toEqual(['p1']); // p3 e arhivată, exclusă
  });

  it('rândul unei achitări asociate arată numele copilului, nu sursa', () => {
    const results = searchRecords(records, 'Ionescu');
    const payment = results.find(r => r.type === 'payments' && r.id === 'p2');
    expect(payment?.label).toBe('Maria Ionescu');
  });
});
