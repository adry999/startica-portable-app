import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { Topbar, type TopbarProps } from './Topbar';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = {
  children: [{ id: 'c1', name: 'Andrei Popescu', parent: 'Maria Popescu', contractNumber: '7', archived: false }],
  payments: [],
  expenses: [],
  groups: [],
  categories: [],
  visits: [],
};

function LocationDisplay() {
  return <p data-testid="location">{useLocation().pathname}</p>;
}

function renderTopbar(props: TopbarProps) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Topbar {...props} />
      <Routes>
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Topbar', () => {
  it('arată eyebrow și titlul ecranului curent', () => {
    renderTopbar({ view: 'payments', month: '2026-09', onMonthChange: () => {} });
    expect(screen.getByText('Contabilitate')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Achitări' })).toBeInTheDocument();
  });

  it('arată căutarea globală doar pe Dashboard', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/']}>
        <Topbar view="dashboard" month="2026-09" onMonthChange={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByPlaceholderText('Caută copil, părinte, achitare…')).toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Topbar view="payments" month="2026-09" onMonthChange={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.queryByPlaceholderText('Caută copil, părinte, achitare…')).not.toBeInTheDocument();
  });

  it('afișează selectorul de lună doar pe Dashboard', () => {
    renderTopbar({ view: 'dashboard', month: '2026-09', onMonthChange: () => {} });
    expect(screen.getByRole('button', { name: 'Septembrie 2026' })).toBeInTheDocument();
  });

  it('nu afișează selectorul de lună pe celelalte ecrane', () => {
    renderTopbar({ view: 'expenses', month: '2026-09', onMonthChange: () => {} });
    expect(screen.queryByRole('button', { name: 'Septembrie 2026' })).not.toBeInTheDocument();
  });

  describe('cu date încărcate', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (path: string) => {
          if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
          if (path === '/api/state')
            return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
          if (path === '/api/health') return jsonResponse({});
          if (path === '/api/exchange-rates')
            return jsonResponse({ rates: { '2026-09-27': 19.62 }, sources: { '2026-09-27': 'bnm' } });
          throw new Error(`neașteptat: ${path}`);
        }),
      );
    });

    it('A8: pastila de curs e link extern spre bnm.md, cu rata și data', async () => {
      const session = renderHook(() => useAppSession());
      await act(() => session.result.current.load());

      renderTopbar({ view: 'dashboard', month: '2026-09', onMonthChange: () => {} });

      const pill = await screen.findByRole('link', { name: /19,6200 lei/ });
      expect(pill).toHaveAttribute('href', 'https://www.bnm.md/');
      expect(pill).toHaveAttribute('target', '_blank');
      expect(pill).toHaveAttribute('rel', 'noopener noreferrer');
      expect(pill).toHaveTextContent('Curs BNM · 27.09.2026');
    });

    it('A8: eyebrow-ul nu conține niciodată filiala, chiar și cu mai multe filiale', async () => {
      const branch = { id: 'b1', name: 'Buiucani', color: 'orange', address: '' };
      const otherBranch = { id: 'b2', name: 'Botanica', color: 'mint', address: '' };
      vi.stubGlobal(
        'fetch',
        vi.fn(async (path: string) => {
          if (path === '/api/session')
            return jsonResponse({ token: 'tok', version: '1.6.3', branch, branches: [branch, otherBranch] });
          if (path === '/api/state')
            return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
          if (path === '/api/health') return jsonResponse({});
          if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
          throw new Error(`neașteptat: ${path}`);
        }),
      );
      const session = renderHook(() => useAppSession());
      await act(() => session.result.current.load());

      renderTopbar({ view: 'dashboard', month: '2026-09', onMonthChange: () => {} });
      expect(screen.getByText('Privire de ansamblu')).toBeInTheDocument();
      expect(screen.queryByText(/Filiala/)).not.toBeInTheDocument();
    });

    it('scrierea unui query arată rezultate live, iar click navighează la fișa copilului', async () => {
      const session = renderHook(() => useAppSession());
      await act(() => session.result.current.load());

      const user = userEvent.setup();
      renderTopbar({ view: 'dashboard', month: '2026-09', onMonthChange: () => {} });

      await user.type(screen.getByPlaceholderText('Caută copil, părinte, achitare…'), 'andrei');
      const result = await screen.findByText('Andrei Popescu');
      await user.click(result);

      expect(await screen.findByTestId('location')).toHaveTextContent('/copii/c1');
    });
  });
});
