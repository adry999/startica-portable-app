import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { StartupScreen } from './StartupScreen';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

describe('StartupScreen — baza locală nu se deschide', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arată eroarea și calea implicită de backup, fără să mai treacă prin pașii normali', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') throw new Error('Conexiune întreruptă.');
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load().catch(() => {}));

    render(<StartupScreen />);

    expect(screen.getByText('Datele nu s-au putut încărca')).toBeInTheDocument();
    expect(screen.getByText(/Deschide dosarul cu backupuri/, { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText(String.raw`%LOCALAPPDATA%\Startica\Startica_Backup`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Încearcă din nou' })).toBeInTheDocument();
  });

  it('„Încearcă din nou” reușit ascunde eroarea', async () => {
    beforeEachSuccessThenFailureFetch();
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load().catch(() => {}));

    render(<StartupScreen />);
    expect(screen.getByText('Datele nu s-au putut încărca')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Încearcă din nou' }));

    expect(screen.queryByText('Datele nu s-au putut încărca')).not.toBeInTheDocument();
  });
});

function beforeEachSuccessThenFailureFetch() {
  let attempt = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      attempt += 1;
      if (path === '/api/session') {
        if (attempt === 1) throw new Error('Conexiune întreruptă.');
        return jsonResponse({ token: 'TOK', version: '2.0.0' });
      }
      if (path === '/api/state')
        return jsonResponse({ state: { children: [] }, revision: 1, updatedAt: '2026-09-27T08:00:00.000Z' });
      if (path === '/api/health') return jsonResponse({});
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}
