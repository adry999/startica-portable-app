import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { useBackup } from './useBackup';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] };

const health = {
  ok: true,
  database: 'startica.db',
  backup: 'ok',
  externalDir: '',
  lastLocal: '2026-09-01T07:00:00.000Z',
  lastExternal: '',
  localError: '',
  externalError: '',
  cloudVerified: false,
  permanentBackups: { count: 2, bytes: 1024 },
  externalBackups: { count: 0, bytes: 0 },
};

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
  return session;
}

describe('useBackup', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse(health);
        if (path === '/api/backup') {
          return jsonResponse({
            ok: true,
            file: 'x',
            name: 'x',
            warning: '',
            health: { ...health, lastLocal: '2026-09-24T08:00:00.000Z' },
          });
        }
        if (path === '/api/settings') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          return jsonResponse({ ok: true, warning: '', health: { ...health, externalDir: body.externalDir } });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('nu e ready cât timp sesiunea nu s-a încărcat', () => {
    const { result } = renderHook(() => useBackup());
    expect(result.current.ready).toBe(false);
  });

  it('calculează starea "vechi/lipsă" pentru un backup local mai vechi de o zi', async () => {
    await loadedSession();
    const { result } = renderHook(() => useBackup());

    expect(result.current.ready).toBe(true);
    expect(result.current.statusLabel).toContain('vechi/lipsă');
    expect(result.current.statusTone).toBe('warning');
  });

  it('backupNow trimite mutația și reîmprospătează health-ul', async () => {
    await loadedSession();
    const { result } = renderHook(() => useBackup());

    await act(() => result.current.backupNow());
    expect(result.current.health?.lastLocal).toBe('2026-09-24T08:00:00.000Z');
  });

  it('saveSettings trimite folderul extern completat', async () => {
    await loadedSession();
    const { result } = renderHook(() => useBackup());

    act(() => result.current.setExternalDirInput('G:\\My Drive\\Startica_Backup'));
    await act(() => result.current.saveSettings());

    expect(result.current.health?.externalDir).toBe('G:\\My Drive\\Startica_Backup');
  });
});
