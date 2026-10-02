import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ModuleGuard } from './ModuleGuard';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] };

/** Primește sesiunea prin fetch mock, ca în AppShell.test.tsx — store-ul e un singleton de modul. */
async function loadSession(profile?: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3', profile });
      if (path === '/api/state')
        return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-10-02T10:00:00Z' });
      if (path === '/api/health') return jsonResponse({});
      throw new Error(`neașteptat: ${path}`);
    }),
  );
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
  vi.unstubAllGlobals();
}

function renderGuard(moduleId: string) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ModuleGuard moduleId={moduleId}>
        <p>Conținut real</p>
      </ModuleGuard>
    </MemoryRouter>,
  );
}

describe('ModuleGuard (§5.3, 36f)', () => {
  it('fără profil în sesiune (compatibilitate) randează conținutul — implicit Complet', async () => {
    await loadSession(undefined);
    renderGuard('payments');
    expect(screen.getByText('Conținut real')).toBeInTheDocument();
  });

  it('profil cu acces la modul randează conținutul, nu starea goală', async () => {
    await loadSession({ preset: 'educator' });
    renderGuard('attendance');
    expect(screen.getByText('Conținut real')).toBeInTheDocument();
  });

  it('profil fără acces la modul arată profil.blocked, cu numele modulului și al profilului', async () => {
    await loadSession({ preset: 'educator' });
    renderGuard('payments');
    expect(screen.queryByText('Conținut real')).not.toBeInTheDocument();
    expect(screen.getByText('Acest calculator nu are acces la Achitări')).toBeInTheDocument();
    expect(screen.getByText(/profilul Educator/)).toBeInTheDocument();
  });

  it('butonul „Mergi la …” duce la primul modul permis (ordinea canonică MODULE_IDS)', async () => {
    await loadSession({ preset: 'educator' });
    renderGuard('payments');
    // Educator: primul modul cu acces de citire în ordinea canonică e „children” → Copii.
    const button = screen.getByRole('button', { name: 'Mergi la Copii' });
    await userEvent.click(button);
    expect(button).toBeInTheDocument();
  });

  it('profil blocat nu arată niciun buton „Mergi la …” (niciun modul permis)', async () => {
    await loadSession({ preset: 'educator', blocked: true });
    renderGuard('attendance');
    expect(screen.queryByText('Conținut real')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mergi la/ })).not.toBeInTheDocument();
  });
});
