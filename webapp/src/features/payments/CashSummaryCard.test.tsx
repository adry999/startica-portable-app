import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { CashSummaryCard } from './CashSummaryCard';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const state = {
  children: [],
  payments: [
    {
      id: 'p1',
      date: '2026-09-24',
      childId: '',
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
      amount: 2000,
      method: 'Card',
      tenders: [{ method: 'Card', amount: 2000 }],
      allocations: [],
      archived: false,
    },
    // Altă zi — nu trebuie să intre în totalurile zilei de 24.
    {
      id: 'p3',
      date: '2026-09-23',
      childId: '',
      sourceName: 'Altcineva',
      amount: 500,
      method: 'Cash',
      tenders: [{ method: 'Cash', amount: 500 }],
      allocations: [],
      archived: false,
    },
  ],
  expenses: [],
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
      if (path === '/api/kindergarten' && !isPost) return jsonResponse({});
      throw new Error(`neașteptat: ${path}`);
    }),
  );
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('CashSummaryCard (44c)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arată schelet de încărcare înainte ca sesiunea să fie gata', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<CashSummaryCard date="2026-09-24" />);
    expect(screen.getAllByRole('status', { name: 'Se încarcă…' }).length).toBeGreaterThan(0);
  });

  it('arată ziua, numărul de achitări și totalul pe fiecare metodă, doar pentru ziua aleasă', async () => {
    await loadedSession();
    render(<CashSummaryCard date="2026-09-24" />);

    expect(await screen.findByText(/24\.09\.2026/)).toBeInTheDocument();
    expect(screen.getByText('2 achitări')).toBeInTheDocument();
    expect(screen.getByText('Numerar')).toBeInTheDocument();
    expect(screen.getByText('9.600,00 lei')).toBeInTheDocument();
    expect(screen.getByText('Card')).toBeInTheDocument();
    expect(screen.getByText('2.000,00 lei')).toBeInTheDocument();
    // Totalul combinat (Cash + Card), nu doar una din metode.
    expect(screen.getByText('11.600,00 lei')).toBeInTheDocument();
    // Plata din 23.09 nu intră în totalurile zilei de 24.
    expect(screen.queryByText('500,00 lei')).not.toBeInTheDocument();
  });

  it('fără nicio achitare în ziua aleasă, totalurile sunt zero și linkul de tipărit nu apare', async () => {
    await loadedSession();
    render(<CashSummaryCard date="2026-09-01" />);

    expect(await screen.findByText('0 achitări')).toBeInTheDocument();
    expect(screen.getAllByText('0,00 lei').length).toBeGreaterThan(0);
    expect(screen.queryByText('Tipărește raportul zilei')).not.toBeInTheDocument();
  });

  it('clic pe mini-cardul unei metode cheamă onFilterMethod cu acea metodă', async () => {
    await loadedSession();
    const onFilterMethod = vi.fn();
    render(<CashSummaryCard date="2026-09-24" onFilterMethod={onFilterMethod} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /Numerar/ }));
    expect(onFilterMethod).toHaveBeenCalledWith('Cash');

    await user.click(screen.getByRole('button', { name: /Card/ }));
    expect(onFilterMethod).toHaveBeenCalledWith('Card');
  });

  it('44c: „Tipărește raportul zilei” declanșează tipărirea', async () => {
    await loadedSession();
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<CashSummaryCard date="2026-09-24" />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Tipărește raportul zilei' }));

    expect(printSpy).toHaveBeenCalledOnce();
  });

  it('fără axe violations', async () => {
    await loadedSession();
    const { container } = render(<CashSummaryCard date="2026-09-24" />);
    await screen.findByText(/24\.09\.2026/);
    expect(await axe(container)).toHaveNoViolations();
  });
});
