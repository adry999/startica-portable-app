import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { usePayments } from './usePayments';
import type { Payment } from '@contracts/record-types.mjs';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// §13.2: usePayments ține căutarea/pastilele în URL (useUrlParams), deci are nevoie de un Router.
function withRouter({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
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
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });
    expect(result.current.status).toBe('loading');
  });

  it('exclude achitările arhivate din filtrul implicit și calculează sumarul pe metodă', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

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
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

    const unassigned = result.current.rows.find(row => row.id === 'p4');
    expect(unassigned?.unassigned).toBe(true);
    expect(unassigned?.childLabel).toBe('Import CSV');
  });

  it('randează alocarea pe 2 luni pentru achitarea de transfer', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

    const transfer = result.current.rows.find(row => row.id === 'p3');
    expect(transfer?.allocations).toHaveLength(2);
    expect(transfer?.allocations.map(a => a.month)).toEqual(['2026-07', '2026-08']);
  });

  it('archiveFilter "archived" arată doar achitarea arhivată', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

    act(() => result.current.setArchiveFilter('archived'));
    expect(result.current.rows.map(row => row.id)).toEqual(['p5']);
  });

  it('filtrul de copil păstrează doar achitările copilului ales', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

    act(() => result.current.setChildId('c2'));
    expect(result.current.rows.map(row => row.id)).toEqual(['p2']);
  });

  it('filtrul de metodă păstrează doar achitările cu acea metodă', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

    act(() => result.current.setMethod('Transfer'));
    expect(result.current.rows.map(row => row.id)).toEqual(['p3']);
  });

  describe('filtrul de serviciu (B3)', () => {
    const servicesFixture = [
      { id: 'gradinita', name: 'Grădiniță', order: 0, tone: 'orange', priceMode: 'free', system: true },
      { id: 'bazin', name: 'Bazin', order: 1, tone: 'blue', priceMode: 'free', system: true },
    ];
    const bazinPayment = {
      id: 'p6',
      date: '2026-09-11',
      childId: 'c1',
      amount: 400,
      method: 'Cash',
      tenders: [{ method: 'Cash', amount: 400 }],
      allocations: [],
      archived: false,
      service: 'bazin',
    };

    async function loadedSessionWithServices() {
      const stateWithServices = {
        ...fixtureState,
        services: servicesFixture,
        payments: [...fixtureState.payments, bazinPayment],
      };
      vi.stubGlobal(
        'fetch',
        vi.fn(async (path: string) => {
          if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
          if (path === '/api/state')
            return jsonResponse({ state: stateWithServices, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
          if (path === '/api/health') return jsonResponse({});
          throw new Error(`neașteptat: ${path}`);
        }),
      );
      const session = renderHook(() => useAppSession());
      await act(() => session.result.current.load());
    }

    it('implicit (Toate) achitările fără `service` numesc Grădiniță, iar lista Serviciu vine din records.services', async () => {
      await loadedSessionWithServices();
      const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

      expect(result.current.services.map(service => service.id)).toEqual(['gradinita', 'bazin']);
      const p1Row = result.current.rows.find(row => row.id === 'p1');
      expect(p1Row?.serviceId).toBe('gradinita');
      expect(p1Row?.serviceLabel).toBe('Grădiniță');
      const bazinRow = result.current.rows.find(row => row.id === 'p6');
      expect(bazinRow?.serviceLabel).toBe('Bazin');
    });

    it('păstrează doar achitările serviciului ales', async () => {
      await loadedSessionWithServices();
      const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

      act(() => result.current.setService('bazin'));
      expect(result.current.rows.map(row => row.id)).toEqual(['p6']);
    });

    it('se combină cu filtrul de metodă (ambele active îngustează suplimentar)', async () => {
      await loadedSessionWithServices();
      const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

      // Două clicuri separate (ca în UI — fiecare pastilă e o interacțiune proprie), nu un singur
      // `act()`: setService + setMethod ating amândouă URL-ul (§13.2 useUrlParams) și s-ar
      // suprascrie reciproc dacă ar porni din același tur de evenimente.
      act(() => result.current.setService('bazin'));
      act(() => result.current.setMethod('Transfer'));
      // p6 e Cash, nu Transfer — niciun rezultat cu ambele filtre active.
      expect(result.current.rows).toEqual([]);
    });

    it('spre deosebire de filtrul de metodă, filtrul de serviciu îngustează și cardurile de sumar', async () => {
      await loadedSessionWithServices();
      const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

      const cashFaraFiltru = result.current.summary.cash;
      act(() => result.current.setService('bazin'));
      expect(result.current.summary.cash).toBe(400);
      expect(result.current.summary.cash).not.toBe(cashFaraFiltru);
    });
  });

  it('periodFrom păstrează doar achitările active din ziua respectivă sau mai târziu', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

    act(() => result.current.setPeriodFrom('2026-08-01'));
    expect(result.current.rows.map(row => row.id).sort()).toEqual(['p1', 'p2', 'p4']);
  });

  it('periodTo păstrează doar achitările active din ziua respectivă sau mai devreme', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

    act(() => result.current.setPeriodTo('2026-08-31'));
    expect(result.current.rows.map(row => row.id).sort()).toEqual(['p2', 'p3']);
  });

  it('periodFrom și periodTo combinate îngustează la un singur interval', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

    act(() => {
      result.current.setPeriodFrom('2026-08-01');
      result.current.setPeriodTo('2026-08-31');
    });
    expect(result.current.rows.map(row => row.id)).toEqual(['p2']);
  });

  it('periodPreset implicit e "tot" (fără limite), ca azi', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

    expect(result.current.periodPreset).toBe('tot');
    expect(result.current.periodFrom).toBe('');
    expect(result.current.periodTo).toBe('');
  });

  it('search găsește achitarea neasociată după sourceName', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

    act(() => result.current.setSearch('Import CSV'));
    expect(result.current.rows.map(row => row.id)).toEqual(['p4']);
  });

  it('search fără potrivire golește lista de rânduri', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

    act(() => result.current.setSearch('inexistent-xyz'));
    expect(result.current.rows).toEqual([]);
  });

  it('initialChildId precompletează filtrul de copil de la montare', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments('c2'), { wrapper: withRouter });

    expect(result.current.childId).toBe('c2');
    expect(result.current.rows.map(row => row.id)).toEqual(['p2']);
  });

  it('summary nu bagă o metodă în afara Cash/Card/Transfer în niciun total (B1 — nu există „Altele”)', async () => {
    const extraPayment = {
      id: 'p6',
      date: '2026-09-15',
      childId: 'c1',
      amount: 250,
      method: 'Revolut',
      tenders: [{ method: 'Revolut', amount: 250 }],
      allocations: [{ month: '2026-09', amount: 250 }],
      archived: false,
    };
    const stateWithUnknownMethod = { ...fixtureState, payments: [...fixtureState.payments, extraPayment] };

    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
      if (path === '/api/state')
        return jsonResponse({ state: stateWithUnknownMethod, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
      if (path === '/api/health') return jsonResponse({});
      throw new Error(`neașteptat: ${path}`);
    });

    await loadedSession();
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

    expect(result.current.summary).not.toHaveProperty('other');
    expect(result.current.summary.cash).toBe(1800);
    expect(result.current.summary.card).toBe(500);
    expect(result.current.summary.transfer).toBe(1000);
  });

  it('archivePayment trimite mutația de arhivare cu archivedAt setat', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

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
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_path: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      expect(body.record.id).toBe('p5');
      expect(body.record.archived).toBe(false);
      expect(body.record.archivedAt).toBeNull();
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await act(() => result.current.unarchivePayment('p5'));
  });

  it('archivePayment pe un id inexistent aruncă eroare în loc să trimită o mutație invalidă', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

    await expect(result.current.archivePayment('nope')).rejects.toThrow('Achitarea nu mai există.');
  });

  it('unarchivePayment pe un id inexistent aruncă eroare în loc să trimită o mutație invalidă', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

    await expect(result.current.unarchivePayment('nope')).rejects.toThrow('Achitarea nu mai există.');
  });

  it('archiveMany trimite câte o mutație pentru fiecare id, secvențial', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

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
    service: 'gradinita',
    tenders: { Cash: '', Card: '600', Transfer: '' },
    sourceName: '',
    reviewed: false,
    allocations: [{ month: '2026-09', amount: '600' }],
    notes: '',
    sendSmsConfirmation: false,
    siblings: [],
  };

  it('createPayment trimite mutația de creare cu id PAY- generat', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

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
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

    const duplicateValues = {
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

    const confirmDuplicate = vi.fn(() => false);
    const saved = await act(() => result.current.createPayment(duplicateValues, confirmDuplicate));
    expect(saved).toBe(false);
    expect(confirmDuplicate).toHaveBeenCalled();
  });

  it('updatePayment păstrează id-ul plății existente', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });
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
        service: 'gradinita',
        tenders: { Cash: '1500', Card: '', Transfer: '' },
        sourceName: '',
        reviewed: false,
        allocations: [{ month: '2026-09', amount: '1500' }],
        notes: '',
        sendSmsConfirmation: false,
        siblings: [],
      }),
    );
  });

  // m8: „Anulează” dintr-un toast ține o referință mai veche la archivePayment/unarchivePayment
  // (capturată la randarea de atunci) — dacă starea s-a schimbat între timp (ex. un receiptNumber
  // atribuit), funcția trebuie să citească snapshot-ul curent al sesiunii, nu closure-ul vechi.
  it('archivePayment citește starea curentă la momentul apelului, nu closure-ul randării în care a fost capturată referința', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });
    const staleArchivePayment = result.current.archivePayment; // ca referința ținută de un toast „Anulează”

    // Alt calculator/altă acțiune atribuie un receiptNumber lui p1 între timp.
    const updatedP1 = { ...fixtureState.payments[0], receiptNumber: 'BON-42' };
    const stateWithReceipt = { ...fixtureState, payments: [updatedP1, ...fixtureState.payments.slice(1)] };
    const session = renderHook(() => useAppSession());
    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async () =>
      jsonResponse({ state: stateWithReceipt, revision: 2, updatedAt: '2026-09-23T10:05:00Z' }),
    );
    await act(() =>
      session.result.current.mutate('/api/record', { type: 'payments', mode: 'update', record: updatedP1 }),
    );

    let sentRecord: Record<string, unknown> = {};
    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_path: string, options: RequestInit) => {
      sentRecord = JSON.parse(options.body as string).record;
      return jsonResponse({ state: stateWithReceipt, revision: 3, updatedAt: '2026-09-23T10:06:00Z' });
    });

    await act(() => staleArchivePayment('p1'));

    expect(sentRecord.receiptNumber).toBe('BON-42');
  });

  it('deletePayment cheamă /api/record-delete cu tipul și id-ul', async () => {
    await loadedSession();
    const { result } = renderHook(() => usePayments(), { wrapper: withRouter });

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
