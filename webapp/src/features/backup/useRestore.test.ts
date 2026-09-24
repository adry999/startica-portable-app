import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { useRestore } from './useRestore';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] };

const localBackups = [
  { name: 'backup-2026-09-23.zip', modified: '2026-09-23T08:00:00.000Z' },
  { name: 'backup-2026-09-22.zip', modified: '2026-09-22T08:00:00.000Z' },
];

const preview = { children: 3, payments: 5, expenses: 2, paymentTotal: 4500, expenseTotal: 600, notes: [], errors: [] };

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
  return session;
}

describe('useRestore', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/backups') return jsonResponse(localBackups);
        if (path.startsWith('/api/backup-preview')) return jsonResponse(preview);
        if (path === '/api/restore') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          expect(body.confirm).toBe('RESTAUREAZA');
          return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-24T10:00:00Z' });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('openDialog încarcă backupurile locale și previzualizarea celui mai recent', async () => {
    await loadedSession();
    const { result } = renderHook(() => useRestore(''));

    act(() => result.current.openDialog());
    await waitFor(() => expect(result.current.options).toHaveLength(2));

    expect(result.current.selectedName).toBe('backup-2026-09-23.zip');
    await waitFor(() => expect(result.current.preview?.summaryLine).toContain('3 copii'));
  });

  it('nu poate confirma restaurarea până nu scrie exact RESTAUREAZA', async () => {
    await loadedSession();
    const { result } = renderHook(() => useRestore(''));

    act(() => result.current.openDialog());
    await waitFor(() => expect(result.current.preview).not.toBeNull());

    expect(result.current.canCommit).toBe(false);
    act(() => result.current.setConfirmText('altceva'));
    expect(result.current.canCommit).toBe(false);
    act(() => result.current.setConfirmText('RESTAUREAZA'));
    expect(result.current.canCommit).toBe(true);
  });

  it('commit trimite numele, folderul gol și textul de confirmare', async () => {
    await loadedSession();
    const { result } = renderHook(() => useRestore(''));

    act(() => result.current.openDialog());
    await waitFor(() => expect(result.current.preview).not.toBeNull());
    act(() => result.current.setConfirmText('RESTAUREAZA'));

    await act(() => result.current.commit());
    expect(result.current.open).toBe(false);
  });
});
