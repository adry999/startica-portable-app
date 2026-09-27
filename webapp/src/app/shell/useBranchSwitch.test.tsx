import { act, renderHook, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { useDirtyForm } from '@shared/state/dirty-forms';
import { performBranchSwitch, readBranchSwitchNote, useBranchSwitch } from './useBranchSwitch';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

/** Promise.withResolvers e ES2024 — webapp/tsconfig.json ține lib la ES2023 (vezi StartupScreen.test.tsx). */
function withResolvers<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

const buiucani = { id: 'b1', name: 'Buiucani', color: 'orange', address: '' };
const botanica = { id: 'b2', name: 'Botanica', color: 'mint', address: '' };
const fixtureState = { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] };

function withRouter(initialEntry: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialEntry]}>
        <ToastProvider>{children}</ToastProvider>
      </MemoryRouter>
    );
  };
}

async function loadSession(branches = [buiucani, botanica]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '2.0.0', branch: buiucani, branches });
      if (path === '/api/state')
        return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-27T10:00:00Z' });
      if (path === '/api/health') return jsonResponse({});
      throw new Error(`neașteptat: ${path}`);
    }),
  );
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
  return session;
}

/** window.location.replace e needefinibil direct în jsdom — înlocuim tot obiectul location. */
const originalLocation = window.location;

function stubLocationReplace() {
  const replaceSpy = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, replace: replaceSpy },
    configurable: true,
    writable: true,
  });
  return replaceSpy;
}

function restoreLocation() {
  Object.defineProperty(window, 'location', { value: originalLocation, configurable: true, writable: true });
}

describe('performBranchSwitch (mecanica de comutare, criteriul 3)', () => {
  afterEach(() => {
    restoreLocation();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('trimite select și reîncarcă la calea modulului curent, fără sub-rută (/achitari/nou → /achitari)', async () => {
    const replaceSpy = stubLocationReplace();
    const calls: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/branches/select') {
          calls.push(JSON.parse(String(init?.body)));
          return jsonResponse({ branch: botanica });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const result = await performBranchSwitch(botanica, buiucani, '/achitari/nou');

    expect(result).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ id: 'b2' });
    expect(replaceSpy).toHaveBeenCalledWith('/achitari');
    expect(JSON.parse(sessionStorage.getItem('branch.switched')!)).toEqual({
      from: 'Buiucani',
      fromId: 'b1',
      to: 'Botanica',
    });
  });

  it('o eroare a serverului lasă filiala curentă și întoarce mesajul, fără reîncărcare', async () => {
    const replaceSpy = stubLocationReplace();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: 'Filiala nu s-a putut deschide.' }) })),
    );

    const result = await performBranchSwitch(botanica, buiucani, '/achitari');

    expect(result).toEqual({ ok: false, message: 'Filiala nu s-a putut deschide.' });
    expect(replaceSpy).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('branch.switched')).toBeNull();
  });

  it('readBranchSwitchNote citește biletul o singură dată și îl șterge — pentru toast-ul „Înapoi la” de după reîncărcare', async () => {
    stubLocationReplace();
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ branch: botanica })));
    await performBranchSwitch(botanica, buiucani, '/');

    expect(readBranchSwitchNote()).toEqual({ from: 'Buiucani', fromId: 'b1', to: 'Botanica' });
    expect(readBranchSwitchNote()).toBeNull();
  });
});

describe('useBranchSwitch', () => {
  afterEach(() => {
    restoreLocation();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('refuză comutarea cât timp o operațiune e busy sau pending, cu toast de verificare', async () => {
    const session = await loadSession();
    session.result.current.state.busy = true;

    const { result } = renderHook(() => useBranchSwitch(), { wrapper: withRouter('/achitari') });

    act(() => {
      result.current.requestSwitch('b2');
    });

    expect(await screen.findByText('Verifică operațiunea anterioară cu „Reîncarcă”.')).toBeInTheDocument();
    session.result.current.state.busy = false;
  });

  it('fără formular nesalvat comută direct — arată ecranul „Se deschide…” cât durează cererea', async () => {
    await loadSession();
    stubLocationReplace();
    const pending = withResolvers<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/branches/select') return pending.promise;
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useBranchSwitch(), { wrapper: withRouter('/achitari') });

    act(() => {
      result.current.requestSwitch('b2');
    });

    expect(result.current.switching).toEqual({ toName: 'Botanica' });

    await act(async () => {
      pending.resolve({ ok: true, status: 200, json: async () => ({ branch: botanica }) } as Response);
      await Promise.resolve();
    });
  });

  it('cu formular nesalvat apare dialogul; „Rămân aici” nu schimbă, „Salvează și schimbă” salvează întâi', async () => {
    await loadSession();
    stubLocationReplace();
    const save = vi.fn(async () => true);
    const selectCalls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/branches/select') {
          selectCalls.push(String(init?.body));
          return jsonResponse({ branch: botanica });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    function useCombined() {
      useDirtyForm({ label: 'o achitare', save });
      return useBranchSwitch();
    }

    const { result } = renderHook(() => useCombined(), { wrapper: withRouter('/achitari') });

    act(() => {
      result.current.requestSwitch('b2');
    });
    expect(result.current.dialog?.form.label).toBe('o achitare');
    expect(selectCalls).toHaveLength(0);

    act(() => {
      result.current.stay();
    });
    expect(result.current.dialog).toBeNull();
    expect(save).not.toHaveBeenCalled();
    expect(selectCalls).toHaveLength(0);

    act(() => {
      result.current.requestSwitch('b2');
    });
    await act(async () => {
      result.current.saveAndSwitch();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(selectCalls).toHaveLength(1);
    expect(result.current.dialog).toBeNull();
  });

  it('„Renunț și schimb” comută fără să salveze', async () => {
    await loadSession();
    stubLocationReplace();
    const save = vi.fn(async () => true);
    const selectCalls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/branches/select') {
          selectCalls.push(String(init?.body));
          return jsonResponse({ branch: botanica });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    function useCombined() {
      useDirtyForm({ label: 'o achitare', save });
      return useBranchSwitch();
    }

    const { result } = renderHook(() => useCombined(), { wrapper: withRouter('/achitari') });

    act(() => {
      result.current.requestSwitch('b2');
    });
    await act(async () => {
      result.current.discardAndSwitch();
      await Promise.resolve();
    });

    expect(save).not.toHaveBeenCalled();
    expect(selectCalls).toHaveLength(1);
  });
});
