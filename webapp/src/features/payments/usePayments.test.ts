import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { usePayments } from './usePayments';
import type { Payment } from '@contracts/record-types.mjs';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// Fixtură: achitări Cash/Card/Transfer, una neasociată (childId gol), una
// arhivată (exclusă din filtrul implicit „active"), una cu alocare pe 2 luni.
const fixtureState = {
  children: [
    { id: 'c1', name: 'Andrei Popescu', groupId: null, archived: false },
    { id: 'c2', name: 'Maria Ionescu', groupId: null, archived: false },
  ],
  payments: [
    {
      id: 'p1',
      date: '2026-09-10',
      childId: 'c1',
      amount: 1500,
      method: 'Cash',
      tenders: [{ method: 'Cash', amount: 1500 }],
      allocations: [{ month: '2026-09', amount: 1500 }],
      archived: false,
    },
    {
      id: 'p2',
      date: '2026-08-05',
      childId: 'c2',
      amount: 500,
      method: 'Card',
      tenders: [{ method: 'Card', amount: 500 }],
      allocations: [{ month: '2026-08', amount: 500 }],
      archived: false,
    },
    {
      id: 'p3',
      date: '2026-07-01',
      childId: 'c1',
      amount: 1000,
      method: 'Transfer',
      tenders: [{ method: 'Transfer', amount: 1000 }],
      allocations: [
        { month: '2026-07', amount: 600 },
        { month: '2026-08', amount: 400 },
      ],
      archived: false,
    },
    {
      id: 'p4',
      date: '2026-09-02',
      childId: '',
      sourceName: 'Import CSV',
      amount: 300,
      method: 'Cash',
      tenders: [{ method: 'Cash', amount: 300 }],
      allocations: [],
      archived: false,
    },
    {
      id: 'p5',
      date: '2026-06-01',
      childId: 'c1',
      amount: 200,
      method: 'Cash',
      tenders: [{ method: 'Cash', amount: 200 }],
      allocations: [{ month: '2026-06', amount: 200 }],
      archived: true,
      archivedAt: '2026-08-01T00:00:00.000Z',
    },
  ],
  expenses: [],
  groups: [],
  categories: [],
  visits: [],
};

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
  return session;
}

describe('usePayments', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('e loading înainte ca sesiunea să fie gata', () => {
    const { result } = renderHook(() => usePayments());
    expect(result.current.status).toBe('loading');
  });

  it('exclude achitările arhivate din filtrul implicit și calculează sumarul pe metodă', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments());

    expect(result.current.status).toBe('ready');
    expect(result.current.rows.map(row => row.id).sort()).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(result.current.summary.count).toBe(4);
    expect(result.current.summary.total).toBe(3300);
    expect(result.current.summary.cash).toBe(1800);
    expect(result.current.summary.card).toBe(500);
    expect(result.current.summary.transfer).toBe(1000);
  });

  it('marchează achitarea fără childId ca neasociată, cu eticheta din sourceName', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments());

    const unassigned = result.current.rows.find(row => row.id === 'p4');
    expect(unassigned?.unassigned).toBe(true);
    expect(unassigned?.childLabel).toBe('Import CSV');
  });

  it('randează alocarea pe 2 luni pentru achitarea de transfer', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments());

    const transfer = result.current.rows.find(row => row.id === 'p3');
    expect(transfer?.allocations).toHaveLength(2);
    expect(transfer?.allocations.map(a => a.month)).toEqual(['2026-07', '2026-08']);
  });

  it('archiveFilter "archived" arată doar achitarea arhivată', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments());

    act(() => result.current.setArchiveFilter('archived'));
    expect(result.current.rows.map(row => row.id)).toEqual(['p5']);
  });

  it('filtrul de copil păstrează doar achitările copilului ales', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments());

    act(() => result.current.setChildId('c2'));
    expect(result.current.rows.map(row => row.id)).toEqual(['p2']);
  });

  it('filtrul de metodă păstrează doar achitările cu acea metodă', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments());

    act(() => result.current.setMethod('Transfer'));
    expect(result.current.rows.map(row => row.id)).toEqual(['p3']);
  });

  it('archivePayment trimite mutația de arhivare cu archivedAt setat', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments());

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_path: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      expect(body.type).toBe('payments');
      expect(body.mode).toBe('update');
      expect(body.record.id).toBe('p1');
      expect(body.record.archived).toBe(true);
      expect(body.record.archivedAt).toEqual(expect.any(String));
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await act(() => result.current.archivePayment('p1'));
  });

  it('unarchivePayment trimite mutația de dezarhivare', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments());

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_path: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      expect(body.record.id).toBe('p5');
      expect(body.record.archived).toBe(false);
      expect(body.record.archivedAt).toBeNull();
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await act(() => result.current.unarchivePayment('p5'));
  });

  it('archiveMany trimite câte o mutație pentru fiecare id, secvențial', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments());

    const archivedIds: string[] = [];
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/api/record') {
        const body = JSON.parse((options as RequestInit).body as string);
        archivedIds.push(body.record.id);
        return jsonResponse({
          state: fixtureState,
          revision: archivedIds.length + 1,
          updatedAt: '2026-09-23T10:05:00Z',
        });
      }
      throw new Error(`neașteptat: ${path}`);
    });

    await act(() => result.current.archiveMany(['p1', 'p2']));
    expect(archivedIds).toEqual(['p1', 'p2']);
  });

  const newPaymentValues = {
    childId: 'c2',
    date: '2026-09-20',
    tenders: { Cash: '', Card: '600', Transfer: '' },
    sourceName: '',
    reviewed: false,
    allocations: [{ month: '2026-09', amount: '600' }],
    notes: '',
  };

  it('createPayment trimite mutația de creare cu id PAY- generat', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments());

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (path: string, options: RequestInit) => {
      expect(path).toBe('/api/record');
      const body = JSON.parse(options.body as string);
      expect(body.mode).toBe('create');
      expect(body.record.id).toMatch(/^PAY-/);
      expect(body.record.amount).toBe(600);
      expect(body.record.method).toBe('Card');
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    const confirmDuplicate = vi.fn(() => true);
    const saved = await act(() => result.current.createPayment(newPaymentValues, confirmDuplicate));
    expect(saved).toBe(true);
    expect(confirmDuplicate).not.toHaveBeenCalled();
  });

  it('createPayment cu un duplicat cere confirmare și renunță dacă e refuzată', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments());

    const duplicateValues = {
      childId: 'c1',
      date: '2026-09-10',
      tenders: { Cash: '1500', Card: '', Transfer: '' },
      sourceName: '',
      reviewed: false,
      allocations: [{ month: '2026-09', amount: '1500' }],
      notes: '',
    };

    const confirmDuplicate = vi.fn(() => false);
    const saved = await act(() => result.current.createPayment(duplicateValues, confirmDuplicate));
    expect(saved).toBe(false);
    expect(confirmDuplicate).toHaveBeenCalled();
  });

  it('updatePayment păstrează id-ul plății existente', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments());
    const payment = result.current.rows.find(row => row.id === 'p1')!;
    const previous = fixtureState.payments.find(p => p.id === 'p1') as unknown as Payment;

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (path: string, options: RequestInit) => {
      expect(path).toBe('/api/record');
      const body = JSON.parse(options.body as string);
      expect(body.mode).toBe('update');
      expect(body.record.id).toBe('p1');
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await act(() =>
      result.current.updatePayment(previous, {
        childId: payment.childId,
        date: payment.date,
        tenders: { Cash: '1500', Card: '', Transfer: '' },
        sourceName: '',
        reviewed: false,
        allocations: [{ month: '2026-09', amount: '1500' }],
        notes: '',
      }),
    );
  });

  it('deletePayment cheamă /api/record-delete cu tipul și id-ul', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments());

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (path: string, options: RequestInit) => {
      expect(path).toBe('/api/record-delete');
      const body = JSON.parse(options.body as string);
      expect(body.type).toBe('payments');
      expect(body.id).toBe('p5');
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await act(() => result.current.deletePayment('p5'));
  });
});
