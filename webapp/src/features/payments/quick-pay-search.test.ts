import { describe, expect, it } from 'vitest';
import { quickPaySearchResults, siblingsOf } from './quick-pay-search';
import type { Child, RecordsSnapshot } from '@contracts/record-types.mjs';

const ASOF = '2026-10-02';

function child(overrides: Partial<Child> & { id: string; name: string }): Child {
  return {
    phone: '',
    phone2: '',
    parent: '',
    groupId: null,
    status: 'Activ',
    statusHistory: [],
    fee: null,
    feeHistory: [],
    dueDay: 10,
    archived: false,
    ...overrides,
  } as Child;
}

const amedeia = child({
  id: 'c1',
  name: 'Amedeia Hudic',
  groupId: 'g-neptun',
  phone: '+37369123456',
  contractNumber: '7',
  attendanceDate: '2026-09-01',
  feeHistory: [{ from: '2020-01', amount: 9845 }],
});

const tudor = child({
  id: 'c2',
  name: 'Tudor Hudic',
  groupId: 'g-marte',
  phone2: '+37369123456', // același telefon de părinte — frate al Amediei
  attendanceDate: '2026-09-01',
  feeHistory: [{ from: '2020-01', amount: 4922 }],
});

const unrelated = child({
  id: 'c3',
  name: 'Ion Popescu',
  groupId: null,
  phone: '+37378000000',
  attendanceDate: '2026-09-01',
  feeHistory: [{ from: '2020-01', amount: 1000 }],
});

const archivedSibling = child({
  id: 'c4',
  name: 'Arhivat Hudic',
  phone: '+37369123456',
  archived: true,
});

function recordsWith(children: Child[]): RecordsSnapshot {
  return {
    children,
    // Tudor are Septembrie achitat integral — rămâne „La zi" la 2 octombrie.
    payments: [
      {
        id: 'p1',
        date: '2026-09-05',
        childId: 'c2',
        amount: 4922,
        method: 'Cash',
        service: 'gradinita',
        tenders: [{ method: 'Cash', amount: 4922 }],
        allocations: [{ month: '2026-09', amount: 4922 }],
        archived: false,
      },
    ],
    expenses: [],
    groups: [
      { id: 'g-neptun', name: 'Neptun' },
      { id: 'g-marte', name: 'Marte' },
    ],
    categories: [],
    visits: [],
  } as unknown as RecordsSnapshot;
}

describe('quickPaySearchResults (44a)', () => {
  it('întoarce o listă goală pentru o căutare goală', () => {
    expect(quickPaySearchResults(recordsWith([amedeia, tudor]), '', ASOF)).toEqual([]);
    expect(quickPaySearchResults(recordsWith([amedeia, tudor]), '   ', ASOF)).toEqual([]);
  });

  it('găsește copilul după nume și aduce fratele (același telefon de părinte) imediat sub el', () => {
    const rows = quickPaySearchResults(recordsWith([amedeia, tudor, unrelated]), 'Amedeia', ASOF);
    expect(rows.map(r => r.childId)).toEqual(['c1', 'c2']);
    expect(rows[0].isSibling).toBe(false);
    expect(rows[1].isSibling).toBe(true);
  });

  it('restanța copilului neachitat arată luna și suma; fratele la zi arată „La zi"', () => {
    const rows = quickPaySearchResults(recordsWith([amedeia, tudor]), 'Amedeia', ASOF);
    const [primary, sibling] = rows;
    expect(primary.statusTone).toBe('overdue');
    expect(primary.statusLabel).toMatch(/^Restanță Sep/);
    expect(sibling.statusTone).toBe('ok');
    expect(sibling.statusLabel).toBe('La zi');
  });

  it('arată taxa lunii curente (Octombrie) pentru fiecare rând, indiferent de restanță', () => {
    const rows = quickPaySearchResults(recordsWith([amedeia, tudor]), 'Amedeia', ASOF);
    expect(rows[0].currentMonthLabel).toMatch(/^Oct: /);
    expect(rows[1].currentMonthLabel).toMatch(/^Oct: /);
  });

  it('subtitlul arată grupa (și „frate" pentru frați)', () => {
    const rows = quickPaySearchResults(recordsWith([amedeia, tudor]), 'Amedeia', ASOF);
    expect(rows[0].subtitle).toMatch(/^Neptun/);
    expect(rows[0].subtitle).not.toMatch(/frate/);
    expect(rows[1].subtitle).toMatch(/^Marte · frate/);
  });

  it('caută și după telefonul părintelui (sufix, §10) sau nr. contract', () => {
    const byPhone = quickPaySearchResults(recordsWith([amedeia, unrelated]), '123456', ASOF);
    expect(byPhone.map(r => r.childId)).toEqual(['c1']);

    const byContract = quickPaySearchResults(recordsWith([amedeia, unrelated]), '7', ASOF);
    expect(byContract.map(r => r.childId)).toContain('c1');
  });

  it('exclude copiii arhivați, chiar dacă sunt frați', () => {
    const rows = quickPaySearchResults(recordsWith([amedeia, archivedSibling]), 'Amedeia', ASOF);
    expect(rows.map(r => r.childId)).toEqual(['c1']);
  });

  it('nu dublează un copil găsit și direct, și ca frate', () => {
    // „Hudic" găsește direct ambii copii — fratele nu trebuie adăugat a doua oară.
    const rows = quickPaySearchResults(recordsWith([amedeia, tudor]), 'Hudic', ASOF);
    expect(rows.map(r => r.childId)).toEqual(['c1', 'c2']);
  });
});

describe('siblingsOf', () => {
  it('găsește copiii cu același telefon 1 sau 2, fără copilul însuși și fără arhivați', () => {
    const siblings = siblingsOf(amedeia, [amedeia, tudor, unrelated, archivedSibling]);
    expect(siblings.map(c => c.id)).toEqual(['c2']);
  });

  it('întoarce o listă goală pentru un copil fără telefon', () => {
    const noPhone = child({ id: 'c5', name: 'Fără Telefon' });
    expect(siblingsOf(noPhone, [amedeia, tudor])).toEqual([]);
  });
});
