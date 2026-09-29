import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { ServicesSettings } from './ServicesSettings';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = {
  children: [],
  payments: [
    { id: 'p1', childId: 'c1', date: '2026-09-01', method: 'Cash', service: 'gradinita', amount: 100, allocations: [] },
  ],
  expenses: [],
  groups: [],
  categories: [],
  visits: [],
  charges: [],
  services: [
    { id: 'gradinita', name: 'Grădiniță', order: 0, tone: 'orange', priceMode: 'free', system: true },
    { id: 'bazin', name: 'Bazin', order: 1, tone: 'blue', priceMode: 'free', system: true },
  ],
};

function renderPage() {
  return render(
    <ToastProvider>
      <ServicesSettings />
    </ToastProvider>,
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

function recordCallsTo(type: string) {
  return (fetch as ReturnType<typeof vi.fn>).mock.calls
    .filter(([path]) => path === '/api/record')
    .map(([, options]) => JSON.parse((options as RequestInit).body as string))
    .filter(body => body.type === type);
}

describe('ServicesSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/record')
          return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('randează cele două servicii de sistem, cu „implicit” doar la Grădiniță', async () => {
    await loadedSession();
    renderPage();

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);

    const gradinitaRow = rows.find(row => within(row).queryByText('Grădiniță'));
    const bazinRow = rows.find(row => within(row).queryByText('Bazin'));
    expect(gradinitaRow).toBeDefined();
    expect(bazinRow).toBeDefined();
    expect(within(gradinitaRow!).getByText('implicit')).toBeInTheDocument();
    expect(within(bazinRow!).queryByText('implicit')).toBeNull();
    // Grădinița are o achitare în fixtură — contorul trebuie să o reflecte.
    expect(within(gradinitaRow!).getByText('1 achitare')).toBeInTheDocument();
    expect(within(bazinRow!).getByText('0 achitări')).toBeInTheDocument();
  });

  it('serviciile de sistem nu au comutator Activ/Ascuns, doar „Editează”', async () => {
    await loadedSession();
    renderPage();

    const rows = screen.getAllByRole('listitem');
    for (const row of rows) {
      expect(within(row).queryByRole('switch')).toBeNull();
      expect(within(row).getByRole('button', { name: 'Editează' })).toBeInTheDocument();
    }
  });

  it('„+ Serviciu” trimite o creare cu numele completat și modul de preț ales', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '+ Serviciu' }));
    await user.type(screen.getByLabelText('Nume'), 'Excursie');
    await user.click(screen.getByRole('radio', { name: 'Preț fix' }));
    await user.type(screen.getByLabelText('Preț (lei)'), '250');
    await user.click(screen.getByRole('button', { name: 'Creează serviciul' }));

    const [created] = recordCallsTo('services').filter(body => body.mode === 'create');
    expect(created.record.name).toBe('Excursie');
    expect(created.record.priceMode).toBe('fixed');
    expect(created.record.price).toBe(250);
    expect(created.record.system).toBe(false);
  });

  it('numele duplicat respins de server apare ca eroare în formular, fără să închidă drawer-ul', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (path: string) => {
      if (path === '/api/record')
        return { ok: false, status: 400, json: async () => ({ error: 'Există deja un serviciu cu acest nume.' }) };
      throw new Error(`neașteptat: ${path}`);
    });

    await user.click(screen.getByRole('button', { name: '+ Serviciu' }));
    await user.type(screen.getByLabelText('Nume'), 'Bazin');
    await user.click(screen.getByRole('button', { name: 'Creează serviciul' }));

    expect(await screen.findByText('Există deja un serviciu cu acest nume.')).toBeInTheDocument();
    // Drawer-ul rămâne deschis — câmpul Nume e încă vizibil.
    expect(screen.getByLabelText('Nume')).toBeInTheDocument();
  });
});
