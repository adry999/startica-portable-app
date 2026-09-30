import { act, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { TopbarActionsProvider, useTopbarActionsSlot, useTopbarTitleSlot } from '@shared/ui';
import { BirthdaysPage } from './BirthdaysPage';

/** Randează sloturile de antet ca Topbar-ul real — vezi BirthdaysPage.test.tsx. */
function TopbarSlots() {
  const title = useTopbarTitleSlot();
  const actions = useTopbarActionsSlot();
  return (
    <>
      {title && (
        <header>
          <h1>{title.title}</h1>
        </header>
      )}
      {actions}
    </>
  );
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/copii/zile-de-nastere?luna=2026-09']}>
      <TopbarActionsProvider>
        <TopbarSlots />
        <Routes>
          <Route path="/copii/zile-de-nastere" element={<BirthdaysPage />} />
        </Routes>
      </TopbarActionsProvider>
    </MemoryRouter>,
  );
}

// Fișier separat de BirthdaysPage.test.tsx (ca StartupScreen.error.test.tsx față de StartupScreen.test.tsx):
// store-ul sesiunii e la nivel de modul — dacă un load() reușit rulează înaintea celui eșuat în același
// fișier, session.state.ready rămâne true, iar eșecul devine invizibil pentru test.
describe('BirthdaysPage — sesiunea nu se încarcă', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('eșecul sesiunii arată eroarea, nu „Nicio zi de naștere” (M9)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') throw new Error('Conexiune întreruptă.');
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load().catch(() => {}));

    renderPage();

    expect(screen.getByText(/Conexiune întreruptă/)).toBeInTheDocument();
    expect(screen.queryByText('Nicio zi de naștere în septembrie')).not.toBeInTheDocument();
  });
});
