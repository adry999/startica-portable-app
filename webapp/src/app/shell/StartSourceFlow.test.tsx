import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { StartSourceFlow } from './StartSourceFlow';

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) };
}

const fixtureState = { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] };

function renderFlow(onDismiss = vi.fn(), onConnectElsewhere = vi.fn()) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <StartSourceFlow onDismiss={onDismiss} onConnectElsewhere={onConnectElsewhere} />
      </ToastProvider>
    </MemoryRouter>,
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
  return session;
}

describe('StartSourceFlow', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('„De la zero” cheamă onDismiss fără alți pași', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-10-02T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    await loadedSession();
    const onDismiss = vi.fn();
    renderFlow(onDismiss);

    await userEvent.click(screen.getByRole('radio', { name: /De la zero/ }));
    await userEvent.click(screen.getByRole('button', { name: /Continuă/ }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('„Am Startica pe alt calculator” cheamă onConnectElsewhere', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-10-02T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    await loadedSession();
    const onConnectElsewhere = vi.fn();
    renderFlow(vi.fn(), onConnectElsewhere);

    await userEvent.click(screen.getByRole('radio', { name: /Am Startica pe alt calculator/ }));
    await userEvent.click(screen.getByRole('button', { name: /Continuă/ }));

    expect(onConnectElsewhere).toHaveBeenCalledOnce();
  });

  it('„Din backup”: previzualizare arhivă, apoi restaurare → RestoreDoneDialog (46b→46d)', async () => {
    const archivePreview = {
      children: 198,
      payments: 1214,
      expenses: 386,
      notes: [],
      errors: [],
      archive: true,
      appVersion: '2.2.0',
      createdAt: '2026-10-01T18:42:00.000Z',
      databases: [
        { id: 'common', name: 'Comun', kind: 'common', counts: {} },
        { id: 'b1', name: 'Buiucani', kind: 'branch', counts: { children: 142, payments: 911, expenses: 264 } },
        { id: 'b2', name: 'Botanica', kind: 'branch', counts: { children: 56, payments: 303, expenses: 122 } },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-10-02T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path.startsWith('/api/backup-preview')) return jsonResponse(archivePreview);
        if (path === '/api/restore') return jsonResponse({ ok: true, warning: '' });
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    await loadedSession();
    renderFlow();

    await userEvent.click(screen.getByRole('radio', { name: /Din backup/ }));
    await userEvent.click(screen.getByRole('button', { name: /Continuă/ }));

    await userEvent.type(
      screen.getByLabelText('Calea completă către fișier'),
      String.raw`C:\backups\startica_2026-10-01_arhiva.startica-backup`,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Previzualizează' }));

    expect(await screen.findByText('Buiucani')).toBeInTheDocument();
    expect(screen.getByText('Comun (personal, bazin, curs, planuri)')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Scrie RESTAUREAZA'), 'RESTAUREAZA');
    await userEvent.click(screen.getByRole('button', { name: 'Restaurează' }));

    expect(await screen.findByText(/Am restaurat 2 filiale și baza Comun/)).toBeInTheDocument();
  });

  it('„Din backup”: o arhivă cu versiune mai nouă arată cardul roz „blocat”, nu tabelul', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-10-02T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path.startsWith('/api/backup-preview'))
          return jsonResponse(
            { error: 'Arhiva a fost creată cu Startica 2.4.0, mai nouă decât versiunea instalată (2.2.0).' },
            400,
          );
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    await loadedSession();
    renderFlow();

    await userEvent.click(screen.getByRole('radio', { name: /Din backup/ }));
    await userEvent.click(screen.getByRole('button', { name: /Continuă/ }));
    await userEvent.type(
      screen.getByLabelText('Calea completă către fișier'),
      String.raw`C:\backups\startica_nou.startica-backup`,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Previzualizează' }));

    expect(await screen.findByText('Backup-ul nu poate fi restaurat')).toBeInTheDocument();
    expect(screen.getByText(/mai nouă decât versiunea instalată/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restaurează' })).not.toBeInTheDocument();
  });

  it('„Din backup”: un .db vechi arată avertismentul galben și permite restaurarea', async () => {
    const legacyPreview = {
      children: 3,
      payments: 5,
      expenses: 2,
      notes: ['Acest backup conține o singură filială; Comun și celelalte filiale nu se schimbă.'],
      errors: [],
      archive: false,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-10-02T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path.startsWith('/api/backup-preview')) return jsonResponse(legacyPreview);
        if (path === '/api/restore')
          return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-10-02T11:00:00Z' });
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    await loadedSession();
    renderFlow();

    await userEvent.click(screen.getByRole('radio', { name: /Din backup/ }));
    await userEvent.click(screen.getByRole('button', { name: /Continuă/ }));
    await userEvent.type(screen.getByLabelText('Calea completă către fișier'), String.raw`C:\backups\vechi.db`);
    await userEvent.click(screen.getByRole('button', { name: 'Previzualizează' }));

    expect(await screen.findByText(/Backup vechi \(\.db\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restaurează' })).toBeInTheDocument();
  });
});
