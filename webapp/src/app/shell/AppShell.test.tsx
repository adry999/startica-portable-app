import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { AppShell } from './AppShell';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = {
  children: [],
  payments: [],
  expenses: [],
  groups: [],
  categories: [],
  visits: [],
};

const NO_UPDATE = {
  updateAvailable: false,
  currentVersion: '1.6.3',
  latestVersion: '',
  releaseUrl: null,
  downloadUrl: null,
  sha256: null,
  notes: null,
  checkedAt: null,
  error: null,
};

class FakeEventSource {
  constructor(public url: string) {}
  addEventListener() {}
  close() {}
}

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ToastProvider>
        <AppShell view="dashboard" onNavigate={() => {}} month="2026-10" onMonthChange={() => {}}>
          <p>Conținut</p>
        </AppShell>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('AppShell — benzile §11 (42a/42b)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('42a: sincronizare oprită (offline) — bandă roz, fără ×, cu numărul de modificări nesincronizate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session')
          return jsonResponse({
            token: 'tok',
            version: '1.6.3',
            sync: { configured: true, deviceName: 'Calculator A', serverUrl: 'https://sync.exemplu.md' },
            update: NO_UPDATE,
          });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-10-02T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/sync/status')
          return jsonResponse({
            configured: true,
            serverUrl: 'https://sync.exemplu.md',
            deviceName: 'Calculator A',
            connection: 'offline',
            pending: 14,
            pushing: false,
            lastSyncedAt: '',
            conflicts: 0,
            lastError: '',
          });
        if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderShell();

    expect(await screen.findByText(/Sincronizare oprită/)).toBeInTheDocument();
    expect(screen.getByText(/14 modificări nesincronizate/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Închide' })).not.toBeInTheDocument();
  });

  it('42b: actualizare gata — bandă mint, se închide cu × și dispare din DOM', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session')
          return jsonResponse({
            token: 'tok',
            version: '2.1.0',
            update: {
              ...NO_UPDATE,
              updateAvailable: true,
              currentVersion: '2.1.0',
              latestVersion: '2.2.0',
              releaseUrl: 'https://github.com/adry999/startica-portable-app/releases/tag/v2.2.0',
              checkedAt: '2026-10-02T08:00:00Z',
            },
          });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-10-02T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderShell();

    expect(await screen.findByText('Startica 2.2.0 e gata de descărcat.')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Închide' }));
    expect(screen.queryByText('Startica 2.2.0 e gata de descărcat.')).not.toBeInTheDocument();
  });

  it('niciun banner când sincronizarea e online și nicio actualizare nu e disponibilă', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3', update: NO_UPDATE });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-10-02T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderShell();

    expect(await screen.findByText('Conținut')).toBeInTheDocument();
    expect(screen.queryByText(/Sincronizare oprită/)).not.toBeInTheDocument();
    expect(screen.queryByText(/e gata de descărcat/)).not.toBeInTheDocument();
  });
});
