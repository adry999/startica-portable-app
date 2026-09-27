import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { useDayClosingReceipt } from './useDayClosingReceipt';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const kindergartenSettings = {
  name: 'Startica SRL',
  displayName: 'Grădinița Startica',
  idno: '',
  administrator: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  iban: '',
  bank: '',
  nextReceiptNumber: 1,
  receiptFormat: 'a5' as const,
  signatureLabel: '',
  footerNote: '',
  logoDataUrl: '',
};

const state = {
  children: [
    {
      id: 'c1',
      name: 'Bivol Eva',
      parent: '',
      phone: '',
      groupId: null,
      status: 'Activ' as const,
      statusHistory: [],
      fee: null,
      feeHistory: [],
      dueDay: 1,
      archived: false,
    },
  ],
  payments: [
    {
      id: 'p1',
      date: '2026-09-24',
      childId: 'c1',
      sourceName: 'Bivol Ion',
      amount: 9600,
      method: 'Cash',
      tenders: [{ method: 'Cash', amount: 9600 }],
      allocations: [],
      archived: false,
    },
    {
      id: 'p2',
      date: '2026-09-24',
      childId: '',
      sourceName: 'Coceva Alisa',
      amount: 13058,
      method: 'Card',
      tenders: [{ method: 'Card', amount: 13058 }],
      allocations: [],
      archived: false,
    },
    {
      id: 'p3',
      date: '2026-09-23',
      childId: '',
      sourceName: 'Nu se numără',
      amount: 5000,
      method: 'Cash',
      tenders: [{ method: 'Cash', amount: 5000 }],
      allocations: [],
      archived: false,
    },
    {
      id: 'p4',
      date: '2026-09-24',
      childId: '',
      sourceName: 'Arhivată',
      amount: 1000,
      method: 'Cash',
      tenders: [{ method: 'Cash', amount: 1000 }],
      allocations: [],
      archived: true,
    },
  ],
  expenses: [
    {
      id: 'e1',
      date: '2026-09-24',
      category: 'Materiale',
      method: 'cash' as const,
      description: 'Cheltuieli cash',
      amount: 1240,
    },
    {
      id: 'e2',
      date: '2026-09-24',
      category: 'Salarii',
      method: 'card' as const,
      description: 'Card, nu scade cash-ul',
      amount: 500,
    },
  ],
  groups: [],
  categories: [],
  visits: [],
};

async function loadedSession() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      const isPost = init?.method === 'POST';
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '2.0.0' });
      if (path === '/api/state' && !isPost)
        return jsonResponse({ state, revision: 1, updatedAt: '2026-09-24T10:00:00Z' });
      if (path === '/api/health') return jsonResponse({});
      if (path === '/api/kindergarten' && !isPost) return jsonResponse(kindergartenSettings);
      throw new Error(`neașteptat: ${path}`);
    }),
  );
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('useDayClosingReceipt', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adună doar plățile zilei cerute, nearhivate, pe metodă', async () => {
    await loadedSession();
    const { result } = renderHook(() => useDayClosingReceipt('2026-09-24'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.rows.map(row => row.payerLabel)).toEqual(['Bivol Ion', 'Coceva Alisa']);
    expect(result.current.totalsByMethod.Cash).toBe(9600);
    expect(result.current.totalsByMethod.Card).toBe(13058);
    expect(result.current.countsByMethod.Cash).toBe(1);
  });

  it('scade din cash doar cheltuielile cu metoda cash ale aceleiași zile', async () => {
    await loadedSession();
    const { result } = renderHook(() => useDayClosingReceipt('2026-09-24'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.cashExpenses).toHaveLength(1);
    expect(result.current.cashExpensesTotal).toBe(1240);
    expect(result.current.inCasa).toBeCloseTo(9600 - 1240);
  });
});
