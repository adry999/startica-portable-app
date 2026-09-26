import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider, TopbarActionsProvider, useTopbarActionsSlot } from '@shared/ui';
import { GroupsPage } from './GroupsPage';

/** Randează slot-ul de antet ca Topbar-ul real — toggle-ul Carduri/Tablă și „+ Grupă nouă" ajung acolo. */
function TopbarActionsSlot() {
  return <>{useTopbarActionsSlot()}</>;
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = {
  children: [
    { id: 'c1', name: 'Andrei Popescu', groupId: 'g1', birthDate: '2020-09-24', archived: false },
    { id: 'c2', name: 'Maria Ionescu', groupId: 'g1', birthDate: '2019-01-15', archived: false },
    { id: 'c3', name: 'Vlad Marin', groupId: null, birthDate: '2020-01-01', archived: false },
  ],
  payments: [],
  expenses: [],
  groups: [
    { id: 'g1', name: 'Fluturași', capacity: 5, educator: 'Ioana' },
    { id: 'g2', name: 'Ursuleți', capacity: 5, educator: 'Maria' },
  ],
  categories: [],
  visits: [],
};

function renderPage() {
  return render(
    <ToastProvider>
      <TopbarActionsProvider>
        <TopbarActionsSlot />
        <GroupsPage />
      </TopbarActionsProvider>
    </ToastProvider>,
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

async function switchToBoard() {
  await userEvent.click(screen.getByRole('radio', { name: 'Tablă' }));
}

function makeDataTransfer() {
  const store: Record<string, string> = {};
  return {
    setData: (format: string, value: string) => {
      store[format] = value;
    },
    getData: (format: string) => store[format] ?? '',
    get types() {
      return Object.keys(store);
    },
    effectAllowed: 'move',
  };
}

function columnRootFor(columnName: string): HTMLElement {
  const head = screen.getByText(columnName).closest('div') as HTMLElement;
  return head.parentElement as HTMLElement;
}

describe('GroupsBoard', () => {
  beforeEach(() => {
    localStorage.clear();
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
    localStorage.clear();
  });

  it('comută din Carduri în Tablă și arată coloanele grupelor plus Fără grupă', async () => {
    await loadedSession();
    renderPage();

    await switchToBoard();

    expect(screen.getByText('Fluturași')).toBeInTheDocument();
    expect(screen.getByText('Ursuleți')).toBeInTheDocument();
    expect(screen.getByText('Fără grupă')).toBeInTheDocument();
    expect(screen.getByText('Vlad Marin')).toBeInTheDocument();
  });

  it('caută un copil în tablă filtrează cardurile din coloane', async () => {
    await loadedSession();
    renderPage();
    await switchToBoard();

    await userEvent.type(screen.getByLabelText('Caută copil în tablă'), 'Vlad');

    expect(screen.getByText('Vlad Marin')).toBeInTheDocument();
    expect(screen.queryByText('Andrei Popescu')).not.toBeInTheDocument();
    expect(screen.queryByText('Maria Ionescu')).not.toBeInTheDocument();
  });

  it('trage un copil dintr-o coloană și îl plasează în altă grupă', async () => {
    await loadedSession();
    renderPage();
    await switchToBoard();

    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' }),
    );

    const sourceCard = screen.getByText('Andrei Popescu').closest('div') as HTMLElement;
    const targetColumn = columnRootFor('Ursuleți');
    const dataTransfer = makeDataTransfer();

    fireEvent.dragStart(sourceCard, { dataTransfer });
    fireEvent.drop(targetColumn, { dataTransfer });

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([path]) => path === '/api/record');
      expect(call).toBeTruthy();
    });

    const recordCall = fetchMock.mock.calls.find(([path]) => path === '/api/record') as [string, RequestInit];
    const body = JSON.parse(recordCall[1].body as string);
    expect(body.record.id).toBe('c1');
    expect(body.record.groupId).toBe('g2');
  });

  it('trage antetul unei coloane peste altă grupă și schimbă ordinea coloanelor', async () => {
    await loadedSession();
    renderPage();
    await switchToBoard();

    const namesBefore = screen.getAllByText(/^(Fluturași|Ursuleți)$/).map(el => el.textContent);
    expect(namesBefore).toEqual(['Fluturași', 'Ursuleți']);

    const sourceHead = screen.getByText('Fluturași').closest('div') as HTMLElement;
    const targetColumn = columnRootFor('Ursuleți');
    const dataTransfer = makeDataTransfer();

    fireEvent.dragStart(sourceHead, { dataTransfer });
    fireEvent.drop(targetColumn, { dataTransfer });

    await waitFor(() => {
      const namesAfter = screen.getAllByText(/^(Fluturași|Ursuleți)$/).map(el => el.textContent);
      expect(namesAfter).toEqual(['Ursuleți', 'Fluturași']);
    });
  });

  it('Restrânge tot ascunde cardurile copiilor, iar Deschide tot le arată din nou', async () => {
    await loadedSession();
    renderPage();
    await switchToBoard();

    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Restrânge tot' }));
    expect(screen.queryByText('Andrei Popescu')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Deschide tot' }));
    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument();
  });
});
