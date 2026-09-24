import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { BackupPage } from './BackupPage';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] };

const health = {
  ok: true,
  database: 'startica.db',
  backup: 'ok',
  externalDir: '',
  lastLocal: '2026-09-23T08:00:00.000Z',
  lastExternal: '',
  localError: '',
  externalError: '',
  cloudVerified: false,
  permanentBackups: { count: 2, bytes: 1024 },
  externalBackups: { count: 0, bytes: 0 },
};

const localBackups = [{ name: 'backup-2026-09-23.zip', modified: '2026-09-23T08:00:00.000Z' }];
const preview = { children: 3, payments: 5, expenses: 2, paymentTotal: 4500, expenseTotal: 600, notes: [], errors: [] };

function renderPage() {
  return render(
    <ToastProvider>
      <BackupPage />
    </ToastProvider>,
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('BackupPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse(health);
        if (path === '/api/backups') return jsonResponse(localBackups);
        if (path.startsWith('/api/backup-preview')) return jsonResponse(preview);
        if (path === '/api/backup') return jsonResponse({ ok: true, file: 'x', name: 'x', warning: '', health });
        if (path === '/api/restore') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          expect(body.confirm).toBe('RESTAUREAZA');
          return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-24T10:00:00Z' });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arată un mesaj de încărcare, apoi starea backup-ului', () => {
    renderPage();
    expect(screen.getByText('Se încarcă starea backup-ului…')).toBeInTheDocument();
  });

  it('backupNow arată un toast de confirmare', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Backup acum');
    await user.click(screen.getByText('Backup acum'));

    expect(await screen.findByText('Backup local verificat creat.')).toBeInTheDocument();
  });

  it('butonul Restaurează rămâne dezactivat până se scrie exact RESTAUREAZA', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByText('Restaurare'));
    await waitFor(() => expect(screen.getByText(/3 copii/)).toBeInTheDocument());

    const restoreButton = screen.getByRole('button', { name: 'Restaurează' });
    expect(restoreButton).toBeDisabled();

    await user.type(screen.getByLabelText('Scrie RESTAUREAZA'), 'RESTAUREAZA');
    expect(restoreButton).not.toBeDisabled();

    await user.click(restoreButton);
    expect(await screen.findByText('Datele au fost restaurate.')).toBeInTheDocument();
  });
});
