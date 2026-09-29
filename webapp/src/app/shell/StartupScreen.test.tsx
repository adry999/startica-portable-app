import { act, render, renderHook, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { StartupScreen } from './StartupScreen';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

async function flushMicrotasks() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

/** Promise.withResolvers e ES2024 — webapp/tsconfig.json ține lib la ES2023, deci reconstruim
 * manual aceeași formă, ca să nu lărgim lib-ul global pentru un singur test. */
function withResolvers<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

/** /api/state rămâne în așteptare toată durata fișierului — simulează o citire a bazei
 * de date care nu se termină, ca să putem verifica pașii și pragurile fără temporizator
 * artificial în componentă (pașii vin din evenimente reale ale sesiunii). */
const stateRequest = withResolvers<unknown>();

describe('StartupScreen', () => {
  beforeAll(async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'TOK', version: '2.0.0' });
        if (path === '/api/state') return jsonResponse(await stateRequest.promise);
        if (path === '/api/health') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    const session = renderHook(() => useAppSession());
    void session.result.current.load();
    // Serverul „răspunde” la 0,2 s de la pornire — pasul 1 va avea o durată reală, nu zero.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(flushMicrotasks);
  });

  afterAll(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('nu arată nimic sub 1 secundă — doar fundalul gol', () => {
    render(<StartupScreen />);
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.queryByAltText('Startica')).not.toBeInTheDocument();
    expect(screen.queryByText(/Pornesc serverul local/)).not.toBeInTheDocument();
  });

  it('după 1 secundă arată iconița, pașii și primul pas bifat cu durata reală', () => {
    render(<StartupScreen />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByAltText('Startica')).toBeInTheDocument();
    // Pasul curent apare de două ori: în rândul de sub bară (cu „…”, A8) și în listă.
    expect(screen.getByText('Citesc baza de date')).toBeInTheDocument();
    expect(screen.getByText('Citesc baza de date…')).toBeInTheDocument();
    expect(screen.getByText('Pregătesc Dashboard-ul')).toBeInTheDocument();
    // pasul de sincronizare nu apare — nu există server comun în această etapă (INTREBARI.md)
    expect(screen.queryByText(/Sincronizez/)).not.toBeInTheDocument();

    const serverStep = screen.getByText('Pornesc serverul local').closest('li');
    expect(serverStep).toHaveTextContent('✓');
    expect(serverStep?.textContent).toMatch(/0,2 s/);

    // ALINIERE-DESIGN.md A8 „Încărcare 21a”: versiunea are prefixul „v”.
    expect(screen.getByText('v2.0.0')).toBeInTheDocument();
  });

  it('arată mesajul de așteptare lungă după 15 secunde, cu buton de reîncercare', () => {
    render(<StartupScreen />);
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(screen.getByText('Pornirea durează mai mult ca de obicei')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Încearcă din nou' })).toBeInTheDocument();
  });
});

describe('StartupScreen — linia de filială (21a)', () => {
  it('arată filiala de îndată ce sesiunea a răspuns, chiar dacă baza nu s-a citit încă', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session')
          return jsonResponse({
            token: 'TOK',
            version: '2.0.0',
            branch: { id: 'b1', name: 'Buiucani', color: 'orange', address: '' },
            branches: [],
          });
        if (path === '/api/state') return new Promise(() => {}); // rămâne în așteptare
        if (path === '/api/health') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    const session = renderHook(() => useAppSession());
    void session.result.current.load();
    await act(flushMicrotasks);

    render(<StartupScreen />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText(/Filiala Buiucani/)).toBeInTheDocument();

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});

describe('StartupScreen — pasul de sincronizare (18-sincronizare.md, Task 8)', () => {
  // /api/state rămâne în așteptare (ca la primul describe din fișier): ready nu devine
  // niciodată true, deci ecranul rămâne vizibil cât verificăm pasul de sincronizare —
  // acel pas e pornit abia după /api/state, deci nu poate fi „bifat” fără să treacă prin
  // ready (același motiv pentru care „Pregătesc Dashboard-ul” nu e testat ca „done” mai sus).
  it('apare când sync.json e configurat, imediat după Citesc baza de date', async () => {
    vi.useFakeTimers();
    const pendingState = withResolvers<unknown>();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session')
          return jsonResponse({
            token: 'TOK',
            version: '2.0.0',
            sync: { configured: true, deviceName: 'Calculator A', serverUrl: 'https://sync.exemplu.md' },
          });
        if (path === '/api/state') return jsonResponse(await pendingState.promise);
        if (path === '/api/health') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    const session = renderHook(() => useAppSession());
    void session.result.current.load();
    await act(flushMicrotasks);

    render(<StartupScreen />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Sincronizez cu serverul comun')).toBeInTheDocument();

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('nu apare când sync.json nu e configurat (comportament de astăzi)', async () => {
    vi.useFakeTimers();
    const pendingState = withResolvers<unknown>();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'TOK', version: '2.0.0' });
        if (path === '/api/state') return jsonResponse(await pendingState.promise);
        if (path === '/api/health') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    const session = renderHook(() => useAppSession());
    void session.result.current.load();
    await act(flushMicrotasks);

    render(<StartupScreen />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText(/Sincronizez/)).not.toBeInTheDocument();

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
