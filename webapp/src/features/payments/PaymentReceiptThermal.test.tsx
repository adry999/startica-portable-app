import { act, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { PaymentReceiptThermal } from './PaymentReceiptThermal';

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

const paymentNumbered = {
  id: 'p1',
  date: '2026-09-24',
  childId: 'c1',
  sourceName: 'Avram Valentin',
  amount: 9993,
  method: 'Cash',
  tenders: [{ method: 'Cash', amount: 9993 }],
  allocations: [{ month: '2026-09', amount: 9993 }],
  receiptNumber: 147,
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
  iban: '',
  bank: '',
  nextReceiptNumber: 148,
  receiptFormat: 'a5' as const,
  signatureLabel: 'Ciobanu Maria',
  footerNote: '',
  logoDataUrl: '',
};

function stateWith(payments: unknown[]) {
  return {
    children: [child],
    payments,
    expenses: [],
    groups: [{ id: 'g1', name: 'Mars' }],
    categories: [],
    visits: [],
  };
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

function renderThermal(paymentId = 'p1') {
  return render(
    <MemoryRouter initialEntries={[`/achitari/${paymentId}/bon-58mm`]}>
      <Routes>
        <Route path="/achitari/:id/bon-58mm" element={<PaymentReceiptThermal />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PaymentReceiptThermal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arată același număr de confirmare ca cel deja asignat, fără altă cerere de numerotare', async () => {
    const receiptNumberCalls: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        const isPost = init?.method === 'POST';
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '2.0.0' });
        if (path === '/api/state' && !isPost)
          return jsonResponse({ state: stateWith([paymentNumbered]), revision: 1, updatedAt: '2026-09-24T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
        if (path === '/api/kindergarten' && !isPost) return jsonResponse(kindergartenSettings);
        if (path === '/api/payments-receipt-number') {
          receiptNumberCalls.push(init);
          throw new Error('nu trebuia apelat — bonul reutilizează numărul deja asignat');
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    await loadedSession();
    renderThermal();

    expect(await screen.findByText('Nr. 0147')).toBeInTheDocument();
    expect(screen.getByText('Avram Maria')).toBeInTheDocument();
    expect(screen.getByText(/Nu ține locul bonului fiscal\./)).toBeInTheDocument();
    expect(receiptNumberCalls).toHaveLength(0);
  });

  it('arată caseta de rest doar când mai există sold pe ultima lună repartizată', async () => {
    const partialPayment = { ...paymentNumbered, amount: 5000, allocations: [{ month: '2026-09', amount: 5000 }] };
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
    renderThermal();

    expect(await screen.findByText('Nr. 0147')).toBeInTheDocument();
    expect(screen.getByText(/^Rest septembrie/)).toBeInTheDocument();
  });
});
