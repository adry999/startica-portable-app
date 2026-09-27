import { act, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { PaymentReceipt } from './PaymentReceipt';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const child = {
  id: 'c1',
  name: 'Avram Maria',
  contractNumber: '12',
  parent: 'Avram Valentin',
  phone: '069000000',
  groupId: 'g1',
  status: 'Activ' as const,
  statusHistory: [{ from: '2026-01', status: 'Activ' as const }],
  fee: 9993,
  feeHistory: [{ from: '2026-01', amount: 9993 }],
  dueDay: 6,
  attendanceDate: '2026-01-10',
  archived: false,
};

const eurChild = {
  ...child,
  id: 'c2',
  name: 'Ionescu Ana',
  feeHistory: [{ from: '2026-01', amount: 150, currency: 'EUR' as const }],
  fee: 150,
};

const paymentUnnumbered = {
  id: 'p1',
  date: '2026-09-24',
  childId: 'c1',
  sourceName: 'Avram Valentin',
  amount: 9993,
  method: 'Cash',
  tenders: [{ method: 'Cash', amount: 9993 }],
  allocations: [{ month: '2026-09', amount: 9993 }],
  archived: false,
};

const kindergartenSettings = {
  name: 'Startica SRL',
  displayName: 'Grădinița Startica',
  idno: '1000600000000',
  administrator: 'Ciobanu Maria',
  address: 'str. Exemplu 12, Chișinău',
  phone: '+373 60 000 000',
  email: '',
  website: '',
  iban: 'MD00AG00000000000000',
  bank: 'Exemplu Bank',
  nextReceiptNumber: 148,
  receiptFormat: 'a5' as const,
  signatureLabel: 'Administrator: Ciobanu Maria',
  footerNote: '',
  logoDataUrl: '',
};

function stateWith(payments: unknown[], children = [child]) {
  return { children, payments, expenses: [], groups: [{ id: 'g1', name: 'Mijlocie' }], categories: [], visits: [] };
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

function renderReceipt(paymentId = 'p1') {
  return render(
    <MemoryRouter initialEntries={[`/achitari/${paymentId}/confirmare`]}>
      <Routes>
        <Route path="/achitari/:id/confirmare" element={<PaymentReceipt />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PaymentReceipt', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asignează numărul la prima randare și arată confirmarea A5', async () => {
    let currentState = stateWith([paymentUnnumbered]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        const isPost = init?.method === 'POST';
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '2.0.0' });
        if (path === '/api/state' && !isPost)
          return jsonResponse({ state: currentState, revision: 1, updatedAt: '2026-09-24T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
        if (path === '/api/kindergarten' && !isPost) return jsonResponse(kindergartenSettings);
        if (path === '/api/payments-receipt-number') {
          currentState = stateWith([{ ...paymentUnnumbered, receiptNumber: 148 }]);
          return jsonResponse({
            ok: true,
            state: currentState,
            revision: 2,
            updatedAt: '2026-09-24T10:01:00Z',
            receiptNumber: 148,
          });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    await loadedSession();
    renderReceipt();

    expect(await screen.findByText('Nr. 0148')).toBeInTheDocument();
    expect(screen.getByText(/Avram Maria · contract nr\. 12/)).toBeInTheDocument();
    expect(screen.getByText(/Suma în litere:/)).toBeInTheDocument();
    expect(screen.getByText(/Nu ține locul bonului fiscal\./)).toBeInTheDocument();
  });

  it('retipărirea unei achitări deja numerotate nu trimite din nou cererea', async () => {
    const numberedState = stateWith([{ ...paymentUnnumbered, receiptNumber: 41 }]);
    const receiptNumberCalls: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        const isPost = init?.method === 'POST';
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '2.0.0' });
        if (path === '/api/state' && !isPost)
          return jsonResponse({ state: numberedState, revision: 1, updatedAt: '2026-09-24T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
        if (path === '/api/kindergarten' && !isPost) return jsonResponse(kindergartenSettings);
        if (path === '/api/payments-receipt-number') {
          receiptNumberCalls.push(init);
          throw new Error('nu trebuia apelat');
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    await loadedSession();
    renderReceipt();

    expect(await screen.findByText('Nr. 0041')).toBeInTheDocument();
    expect(receiptNumberCalls).toHaveLength(0);
  });

  it('arată caseta de rest doar când mai există sold pe ultima lună repartizată', async () => {
    const partialPayment = {
      ...paymentUnnumbered,
      receiptNumber: 50,
      amount: 5000,
      allocations: [{ month: '2026-09', amount: 5000 }],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        const isPost = init?.method === 'POST';
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '2.0.0' });
        if (path === '/api/state' && !isPost)
          return jsonResponse({ state: stateWith([partialPayment]), revision: 1, updatedAt: '2026-09-24T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
        if (path === '/api/kindergarten' && !isPost) return jsonResponse(kindergartenSettings);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    await loadedSession();
    renderReceipt();

    expect(await screen.findByText('Nr. 0050')).toBeInTheDocument();
    expect(screen.getByText('Rest de achitat:')).toBeInTheDocument();
  });

  it('arată blocul EUR pentru un copil cu taxă în euro', async () => {
    const eurPayment = {
      id: 'p2',
      date: '2026-09-24',
      childId: 'c2',
      sourceName: 'Ionescu Radu',
      amount: 2955,
      method: 'Cash',
      tenders: [{ method: 'Cash', amount: 2955 }],
      allocations: [{ month: '2026-09', amount: 2955 }],
      currency: 'MDL' as const,
      fxRate: 19.7,
      fxRateSource: 'bnm' as const,
      amountEur: 150,
      receiptNumber: 60,
      archived: false,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        const isPost = init?.method === 'POST';
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '2.0.0' });
        if (path === '/api/state' && !isPost)
          return jsonResponse({
            state: stateWith([eurPayment], [eurChild]),
            revision: 1,
            updatedAt: '2026-09-24T10:00:00Z',
          });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/exchange-rates') return jsonResponse({ rates: { '2026-09-24': 19.7 }, sources: {} });
        if (path === '/api/kindergarten' && !isPost) return jsonResponse(kindergartenSettings);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    await loadedSession();
    renderReceipt('p2');

    expect(await screen.findByText('Nr. 0060')).toBeInTheDocument();
    expect(screen.getByText(/Echivalent/)).toBeInTheDocument();
    expect(screen.getByText(/Restul se achită în lei la cursul BNM din ziua plății\./)).toBeInTheDocument();
  });

  it('formatul A4 · 1/3 + 2/3 arată ambele exemplare cu același număr', async () => {
    const numberedPayment = { ...paymentUnnumbered, receiptNumber: 148 };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        const isPost = init?.method === 'POST';
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '2.0.0' });
        if (path === '/api/state' && !isPost)
          return jsonResponse({
            state: stateWith([numberedPayment]),
            revision: 1,
            updatedAt: '2026-09-24T10:00:00Z',
          });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
        if (path === '/api/kindergarten' && !isPost)
          return jsonResponse({ ...kindergartenSettings, receiptFormat: 'a4-third' });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    await loadedSession();
    renderReceipt();

    expect(await screen.findByText('Exemplar grădiniță')).toBeInTheDocument();
    expect(screen.getByText('Tăiați aici')).toBeInTheDocument();
    expect(screen.getByText('Mulțumim pentru plată!')).toBeInTheDocument();
    expect(screen.getAllByText(/0148/).length).toBeGreaterThanOrEqual(2);
  });
});
