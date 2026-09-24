import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { Topbar } from './Topbar';

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

describe('Topbar', () => {
  it('arată eyebrow și titlul ecranului curent', () => {
    render(<Topbar view="payments" month="2026-09" onMonthChange={() => {}} onSelectResult={() => {}} />);
    expect(screen.getByText('Contabilitate')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Achitări' })).toBeInTheDocument();
  });

  it('arată căutarea globală doar pe Dashboard', () => {
    const { rerender } = render(
      <Topbar view="dashboard" month="2026-09" onMonthChange={() => {}} onSelectResult={() => {}} />,
    );
    expect(screen.getByPlaceholderText('Caută copil, părinte, achitare…')).toBeInTheDocument();

    rerender(<Topbar view="payments" month="2026-09" onMonthChange={() => {}} onSelectResult={() => {}} />);
    expect(screen.queryByPlaceholderText('Caută copil, părinte, achitare…')).not.toBeInTheDocument();
  });

  it('afișează selectorul de lună pe orice ecran', () => {
    render(<Topbar view="expenses" month="2026-09" onMonthChange={() => {}} onSelectResult={() => {}} />);
    expect(screen.getByRole('button', { name: 'Septembrie 2026' })).toBeInTheDocument();
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
          throw new Error(`neașteptat: ${path}`);
        }),
      );
    });

    it('scrierea unui query arată rezultate live, iar click apelează onSelectResult', async () => {
      const session = renderHook(() => useAppSession());
      await act(() => session.result.current.load());

      const onSelectResult = vi.fn();
      const user = userEvent.setup();
      render(<Topbar view="dashboard" month="2026-09" onMonthChange={() => {}} onSelectResult={onSelectResult} />);

      await user.type(screen.getByPlaceholderText('Caută copil, părinte, achitare…'), 'andrei');
      const result = await screen.findByText('Andrei Popescu');
      await user.click(result);

      expect(onSelectResult).toHaveBeenCalledWith(expect.objectContaining({ type: 'children', id: 'c1' }));
    });
  });
});
