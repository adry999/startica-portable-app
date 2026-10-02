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

  it('o căutare non-telefon, non-numerică rămâne neschimbată (fără regresie, 41c)', () => {
    expect(searchRecords(records, 'Maria').some(r => r.type === 'children' && r.id === 'c2')).toBe(true);
    expect(searchRecords(records, 'xyz-inexistent')).toEqual([]);
  });
});

describe('searchRecords — 41c: potrivire pe telefon (sufix)', () => {
  const phoneRecords = {
    children: [
      {
        id: 'c1',
        name: 'Andrei Popescu',
        parent: 'Maria Popescu',
        phone: '+37369123456',
        contractNumber: '7',
        archived: false,
      },
      {
        id: 'c2',
        name: 'Maria Ionescu',
        parent: 'Ioana Ionescu',
        phone: '',
        phone2: '+37368111234',
        contractNumber: '12',
        archived: false,
      },
      {
        id: 'c3',
        name: 'Ionuț Vechi',
        parent: 'Elena Vechi',
        phone: '',
        pickupPersons: [{ id: 'P1', name: 'Bunica', phone: '+37367999888' }],
        contractNumber: '3',
        archived: false,
      },
    ],
    payments: [],
    expenses: [],
    groups: [],
    categories: [],
    visits: [],
  } as unknown as RecordsSnapshot;

  it('găsește după telefonul părintelui 1, scris în orice format', () => {
    for (const query of ['069123456', '+37369123456', '69123456', '0037369123456']) {
      const results = searchRecords(phoneRecords, query);
      expect(results.map(r => r.id)).toEqual(['c1']);
    }
  });

  it('găsește după un fragment — sufixul numărului, indiferent de prefixul de țară', () => {
    const results = searchRecords(phoneRecords, '3456');
    expect(results.map(r => r.id)).toEqual(['c1']);
  });

  it('găsește și după telefonul părintelui 2', () => {
    const results = searchRecords(phoneRecords, '1234');
    expect(results.map(r => r.id)).toEqual(['c2']);
  });

  it('găsește și după telefonul unei persoane autorizate', () => {
    const results = searchRecords(phoneRecords, '9888');
    expect(results.map(r => r.id)).toEqual(['c3']);
  });

  it('un fragment prea scurt (sub 3 cifre) nu declanșează potrivirea de telefon', () => {
    expect(searchRecords(phoneRecords, '34')).toEqual([]);
  });
});

describe('searchRecords — 41c: potrivire pe sumă (achitări și cheltuieli)', () => {
  const amountRecords = {
    children: [],
    payments: [
      { id: 'p1', childId: '', sourceName: 'Plată veche', date: '2026-09-01', amount: 500, archived: false },
      { id: 'p2', childId: '', sourceName: 'Plată nouă', date: '2026-09-20', amount: 500, archived: false },
      { id: 'p3', childId: '', sourceName: 'Arhivată', date: '2026-09-25', amount: 500, archived: true },
    ],
    expenses: [
      { id: 'e1', category: 'Utilități', description: 'Curent', date: '2026-09-10', amount: 500, archived: false },
    ],
    groups: [],
    categories: [],
    visits: [],
  } as unknown as RecordsSnapshot;

  it('găsește achitări și cheltuieli cu suma exactă, exclude arhivatele', () => {
    const results = searchRecords(amountRecords, '500');
    expect(
      results
        .filter(r => r.type === 'payments')
        .map(r => r.id)
        .sort(),
    ).toEqual(['p1', 'p2']);
    expect(results.filter(r => r.type === 'expenses').map(r => r.id)).toEqual(['e1']);
  });

  it('acceptă suma cu zecimale (500.00)', () => {
    const results = searchRecords(amountRecords, '500.00');
    expect(results.some(r => r.type === 'payments' && r.id === 'p1')).toBe(true);
  });

  it('cele mai noi rezultate de sumă apar primele, în fiecare grup (achitări/cheltuieli)', () => {
    const results = searchRecords(amountRecords, '500');
    // p2 (2026-09-20) înaintea lui p1 (2026-09-01), în grupul de achitări.
    expect(results.filter(r => r.type === 'payments').map(r => r.id)).toEqual(['p2', 'p1']);
  });

  it('plafonează la 5 rezultate combinate (achitări + cheltuieli), cele mai noi primele', () => {
    const many = {
      children: [],
      payments: Array.from({ length: 4 }, (_, index) => ({
        id: `mp${index}`,
        childId: '',
        sourceName: '',
        date: `2026-09-0${index + 1}`,
        amount: 500,
        archived: false,
      })),
      expenses: Array.from({ length: 4 }, (_, index) => ({
        id: `me${index}`,
        category: 'X',
        description: '',
        date: `2026-09-1${index + 1}`,
        amount: 500,
        archived: false,
      })),
      groups: [],
      categories: [],
      visits: [],
    } as unknown as RecordsSnapshot;

    const results = searchRecords(many, '500').filter(r => r.type === 'payments' || r.type === 'expenses');
    // Cele mai noi 5 date din cele 8 (2026-09-11..14 cheltuieli + 2026-09-01..04 plăți) sunt
    // cheltuielile me3..me0 (14,13,12,11) și cea mai nouă plată mp3 (04) — plafon combinat, nu 5+5.
    expect(results).toHaveLength(5);
    expect(results.map(r => r.id).sort()).toEqual(['me0', 'me1', 'me2', 'me3', 'mp3']);
  });

  it('un text obișnuit (nenumeric) nu declanșează potrivirea pe sumă', () => {
    const results = searchRecords(amountRecords, 'Plată nouă');
    expect(results.filter(r => r.type === 'expenses')).toEqual([]);
    expect(results.map(r => r.id)).toEqual(['p2']);
  });
});
