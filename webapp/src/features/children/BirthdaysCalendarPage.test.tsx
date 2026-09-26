import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { BirthdaysCalendarPage } from './BirthdaysCalendarPage';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// Ziua de naștere trebuie să cadă în luna curentă (implicit, fără initialMonth) — un an fix
// ar deveni flaky pe măsură ce trece timpul, ca la useVisits/useDashboard.
const THIS_MONTH = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

const fixtureState = {
  children: [
    {
      id: 'c1',
      name: 'Andrei Popescu',
      status: 'Activ',
      groupId: 'g1',
      parent: '',
      phone: '',
      fee: 1500,
      feeHistory: [],
      dueDay: 10,
      birthDate: `2019-${THIS_MONTH.slice(5, 7)}-12`,
      archived: false,
    },
    {
      id: 'c2',
      name: 'Maria Ionescu',
      status: 'Activ',
      groupId: 'g2',
      parent: '',
      phone: '',
      fee: 1500,
      feeHistory: [],
      dueDay: 10,
      birthDate: `2020-${THIS_MONTH.slice(5, 7)}-20`,
      archived: false,
    },
  ],
  payments: [],
  expenses: [],
  groups: [
    { id: 'g1', name: 'Mars', capacity: 15 },
    { id: 'g2', name: 'Soare', capacity: 15 },
  ],
  categories: [],
  visits: [],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <BirthdaysCalendarPage />
    </MemoryRouter>,
  );
}

describe('BirthdaysCalendarPage', () => {
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

  it('arată zilele de naștere din luna curentă în lista „Toată luna"', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument();
    expect(screen.getByText('Maria Ionescu')).toBeInTheDocument();
    expect(screen.getByText('2 zile de naștere')).toBeInTheDocument();
  });

  it('filtrează lista la grupa selectată', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Mars' }));

    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument();
    expect(screen.queryByText('Maria Ionescu')).not.toBeInTheDocument();
    expect(screen.getByText('1 zi de naștere')).toBeInTheDocument();
  });
});
