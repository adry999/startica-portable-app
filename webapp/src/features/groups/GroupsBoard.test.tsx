import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { useGroups } from './useGroups';
import { GroupsBoard } from './GroupsBoard';

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

function BoardHarness() {
  const data = useGroups();
  if (data.status !== 'ready') return null;
  return <GroupsBoard data={data} />;
}

function renderBoard() {
  return render(
    <ToastProvider>
      <BoardHarness />
    </ToastProvider>,
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
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

function tileFor(groupName: string): HTMLElement {
  return screen.getByText(groupName).closest('div[class*="tile"]') as HTMLElement;
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

  it('arată panoul Fără grupă și tile-urile grupelor', async () => {
    await loadedSession();
    renderBoard();

    expect(screen.getByText('Fluturași')).toBeInTheDocument();
    expect(screen.getByText('Ursuleți')).toBeInTheDocument();
    expect(screen.getByText('Fără grupă')).toBeInTheDocument();
    expect(screen.getByText('Vlad Marin')).toBeInTheDocument();
  });

  it('căutarea din panoul Fără grupă filtrează doar lista de acolo, nu și copiii din tile-uri', async () => {
    await loadedSession();
    renderBoard();

    await userEvent.type(screen.getByLabelText('Caută copil fără grupă'), 'Vlad');

    expect(screen.getByText('Vlad Marin')).toBeInTheDocument();
    expect(screen.getByText('Andrei P.')).toBeInTheDocument(); // pastila din tile arată „Prenume N.”, nu numele complet
  });

  it('trage un copil din Fără grupă pe un tile și îl mută în acea grupă', async () => {
    await loadedSession();
    renderBoard();

    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' }),
    );

    const sourceRow = screen.getByText('Vlad Marin').closest('div') as HTMLElement;
    const targetTile = tileFor('Ursuleți');
    const dataTransfer = makeDataTransfer();

    fireEvent.dragStart(sourceRow, { dataTransfer });
    fireEvent.drop(targetTile, { dataTransfer });

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([path]) => path === '/api/record');
      expect(call).toBeTruthy();
    });

    const recordCall = fetchMock.mock.calls.find(([path]) => path === '/api/record') as [string, RequestInit];
    const body = JSON.parse(recordCall[1].body as string);
    expect(body.type).toBe('children');
    expect(body.record.id).toBe('c3');
    expect(body.record.groupId).toBe('g2');
  });

  it('trage mânerul unei grupe peste alt tile și persistă noua ordine prin /api/record', async () => {
    await loadedSession();
    renderBoard();

    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async () =>
      jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' }),
    );

    const handle = screen.getByLabelText('Mută grupa Fluturași');
    const targetTile = tileFor('Ursuleți');
    const dataTransfer = makeDataTransfer();

    fireEvent.dragStart(handle, { dataTransfer });
    fireEvent.drop(targetTile, { dataTransfer });

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter(([path]) => path === '/api/record');
      expect(calls.length).toBeGreaterThanOrEqual(2);
    });

    const groupCalls = fetchMock.mock.calls
      .filter(([path]) => path === '/api/record')
      .map(([, options]) => JSON.parse((options as RequestInit).body as string))
      .filter(body => body.type === 'groups');
    const orders = Object.fromEntries(groupCalls.map(body => [body.record.id, body.record.order]));
    expect(orders).toEqual({ g2: 0, g1: 1 });
  });

  it('nu trimite nicio mutație la drop fără date de tragere', async () => {
    await loadedSession();
    renderBoard();

    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    const targetTile = tileFor('Ursuleți');
    fireEvent.drop(targetTile, { dataTransfer: makeDataTransfer() });

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fetchMock.mock.calls.find(([path]) => path === '/api/record')).toBeUndefined();
  });
});
