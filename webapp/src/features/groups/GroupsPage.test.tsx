import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider, TopbarActionsProvider, useTopbarActionsSlot } from '@shared/ui';
import { GroupsPage } from './GroupsPage';

/** Randează slot-ul de antet ca Topbar-ul real — butonul „+ Grupă nouă" ajunge acolo, nu în pagină. */
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
    { id: 'c4', name: 'Vlad Marin', groupId: null, birthDate: '2020-01-01', archived: false },
  ],
  payments: [],
  expenses: [],
  groups: [
    { id: 'g1', name: 'Fluturași', capacity: 2, educator: 'Ioana' },
    { id: 'g2', name: 'Ursuleți', capacity: 5, educator: 'Maria' },
  ],
  categories: [],
  visits: [],
};

function renderPage(onOpenGroupStickers?: (groupId: string) => void) {
  return render(
    <ToastProvider>
      <TopbarActionsProvider>
        <div data-testid="topbar-slot">
          <TopbarActionsSlot />
        </div>
        <GroupsPage onOpenGroupStickers={onOpenGroupStickers} />
      </TopbarActionsProvider>
    </ToastProvider>,
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('GroupsPage', () => {
  beforeEach(() => {
    // Testul „doar în modul Tablă” schimbă view-ul persistat — fără curățare, testele
    // care rulează după el ar porni tot în Tablă (usePersistedState citește localStorage).
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

  it('arată starea de încărcare înainte ca sesiunea să fie gata', () => {
    vi.useFakeTimers();
    try {
      renderPage();
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByRole('status', { name: 'Se încarcă…' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('randează grupele ca titluri de card cu ocupare', async () => {
    await loadedSession();
    renderPage();

    expect(screen.getByText('Fluturași')).toBeInTheDocument();
    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.getByText('Ursuleți')).toBeInTheDocument();
    expect(screen.getByText('0/5')).toBeInTheDocument();
    expect(screen.getByText('+ Grupă nouă')).toBeInTheDocument();
    expect(screen.getByText('2 copii în grupe · 1 fără grupă')).toBeInTheDocument();
  });

  it('„+ Grupă nouă” stă în antet doar în modul Tablă, nu în Carduri', async () => {
    await loadedSession();
    renderPage();

    const topbarSlot = screen.getByTestId('topbar-slot');
    expect(within(topbarSlot).queryByRole('button', { name: '+ Grupă nouă' })).not.toBeInTheDocument();
    expect(within(topbarSlot).getByText('2 copii în grupe · 1 fără grupă')).toBeInTheDocument();

    await userEvent.click(within(topbarSlot).getByRole('radio', { name: 'Tablă' }));

    expect(within(topbarSlot).getByRole('button', { name: '+ Grupă nouă' })).toBeInTheDocument();
    expect(within(topbarSlot).getByText('2 copii în grupe · 1 fără grupă')).toBeInTheDocument();
  });

  it('un singur editor e deschis o dată, la click pe card', async () => {
    await loadedSession();
    renderPage();

    await userEvent.click(screen.getByText('Fluturași'));
    expect(screen.getByText(/^Copii în grupă · 2/)).toBeInTheDocument();

    await userEvent.click(screen.getByText('Ursuleți'));
    expect(screen.getByText('Copii în grupă · 0')).toBeInTheDocument();
    expect(screen.queryByText(/^Copii în grupă · 2/)).not.toBeInTheDocument();
  });

  it('creează o grupă nouă din cardul punctat', async () => {
    await loadedSession();
    renderPage();

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_path: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      expect(body.record.name).toBe('Pinguini');
      expect(body.record.capacity).toBe(6);
      return jsonResponse({
        state: {
          ...fixtureState,
          groups: [...fixtureState.groups, { id: body.record.id, name: 'Pinguini', capacity: 6, educator: '' }],
        },
        revision: 2,
        updatedAt: '2026-09-23T10:05:00Z',
      });
    });

    await userEvent.click(screen.getByRole('button', { name: '+ Grupă nouă' }));
    await userEvent.type(screen.getByLabelText('Nume grupă'), 'Pinguini');
    await userEvent.type(screen.getByLabelText('Capacitate'), '6');
    await userEvent.click(screen.getByRole('button', { name: 'Salvează' }));

    expect(await screen.findByText('Grupă creată.')).toBeInTheDocument();
  });

  it('atribuie un copil fără grupă din editor', async () => {
    await loadedSession();
    renderPage();

    await userEvent.click(screen.getByText('Ursuleți'));

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_path: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      expect(body.record.id).toBe('c4');
      expect(body.record.groupId).toBe('g2');
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await userEvent.click(screen.getByRole('button', { name: 'Copil fără grupă' }));
    await userEvent.click(screen.getByText('Vlad Marin'));
    await userEvent.click(screen.getByRole('button', { name: '+ Adaugă' }));

    expect(await screen.findByText('Copil atribuit grupei.')).toBeInTheDocument();
  });

  it('cere navigarea la stickerele grupei din meniul ⋯, fără să deschidă editorul', async () => {
    await loadedSession();
    const onOpenGroupStickers = vi.fn();
    renderPage(onOpenGroupStickers);

    const menu = screen.getByLabelText('Acțiuni grupa Fluturași').closest('details')!;
    await userEvent.click(screen.getByLabelText('Acțiuni grupa Fluturași'));
    await userEvent.click(within(menu).getByRole('button', { name: 'Stickere pentru grupă' }));

    expect(onOpenGroupStickers).toHaveBeenCalledWith('g1');
    expect(screen.queryByText(/^Copii în grupă/)).not.toBeInTheDocument();
  });
});
