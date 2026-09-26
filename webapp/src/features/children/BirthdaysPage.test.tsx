import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { TopbarActionsProvider, useTopbarActionsSlot, useTopbarTitleSlot } from '@shared/ui';
import { BirthdaysPage } from './BirthdaysPage';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

/** Randează sloturile de antet ca Topbar-ul real — titlul și butoanele „Azi"/„‹›" ajung acolo, nu în pagină. */
function TopbarSlots() {
  const title = useTopbarTitleSlot();
  const actions = useTopbarActionsSlot();
  return (
    <>
      {title && (
        <header>
          <h1>{title.title}</h1>
          <p>{title.eyebrow}</p>
        </header>
      )}
      {actions}
    </>
  );
}

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

const child = (id: string, name: string, birthDate: string, groupId: string | null = null) => ({
  id,
  name,
  status: 'Activ',
  groupId,
  parent: '',
  phone: '',
  fee: 1500,
  feeHistory: [],
  dueDay: 10,
  birthDate,
  archived: false,
});

const fixtureState = {
  children: [
    child('c1', 'Cujba Ovidiu', '2023-09-11', 'g1'),
    child('c2', 'Ionescu Maria', '2020-09-20', 'g2'),
    child('c3', 'Radu Ana', '2021-09-11', null),
    child('c4', 'Sturza Emil', '2021-09-11', null),
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
    <MemoryRouter initialEntries={['/copii/zile-de-nastere?luna=2026-09']}>
      <TopbarActionsProvider>
        <TopbarSlots />
        <Routes>
          <Route path="/copii/zile-de-nastere" element={<BirthdaysPage />} />
          <Route path="/copii/:childId" element={<LocationDisplay />} />
        </Routes>
      </TopbarActionsProvider>
    </MemoryRouter>,
  );
}

describe('BirthdaysPage', () => {
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

  it('arată titlul „Zile de naștere" în antet', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    expect(screen.getByRole('heading', { name: 'Zile de naștere' })).toBeInTheDocument();
    expect(screen.getByText('Evidență · Copii')).toBeInTheDocument();
  });

  it('click pe „›" schimbă luna; „Azi" revine la luna curentă', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    expect(screen.getByText('Septembrie 2026')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Luna următoare' }));
    expect(screen.getByText('Octombrie 2026')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Azi' }));
    expect(screen.getByText('Septembrie 2026')).toBeInTheDocument();
  });

  it('filtrul pe grupă ascunde copiii din celelalte grupe și actualizează contorul', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    expect(screen.getByText('4 zile de naștere')).toBeInTheDocument();
    expect(screen.getByText('Cujba Ovidiu')).toBeInTheDocument();
    expect(screen.getByText('Ionescu Maria')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Mars' }));
    expect(screen.getByText('1 zi de naștere')).toBeInTheDocument();
    expect(screen.getByText('Cujba Ovidiu')).toBeInTheDocument();
    expect(screen.queryByText('Ionescu Maria')).not.toBeInTheDocument();
  });

  it('3 copii în aceeași zi arată 2 chip-uri + „+1 copii" în grilă, dar toți 3 în listă', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    // c1, c3, c4 sunt toți pe 11 septembrie.
    expect(screen.getByText('+1 copii')).toBeInTheDocument();
    const sideList = screen.getByText('Toată luna').closest('aside') as HTMLElement;
    expect(within(sideList).getAllByText(/împlinește/)).toHaveLength(4);
  });

  it('click pe un rând din listă navighează la /copii/:childId', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    await userEvent.click(screen.getByText('Cujba Ovidiu'));
    expect(screen.getByTestId('location')).toHaveTextContent('/copii/c1');
  });
});
