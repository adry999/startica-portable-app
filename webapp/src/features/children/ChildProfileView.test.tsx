import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { ChildProfileView } from './ChildProfileView';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const child = {
  id: 'C1',
  name: 'Ana Popescu',
  status: 'Activ',
  groupId: 'G1',
  parent: 'Maria Popescu',
  phone: '069000000',
  fee: 1500,
  feeHistory: [{ from: '2020-01', amount: 1500 }],
  statusHistory: [],
  dueDay: 10,
  attendanceDate: '2022-09-01',
  archived: false,
  notes: [{ id: 'NOTE-1', text: 'notă veche', date: '2026-01-01' }] as { id: string; text: string; date: string }[],
  idnp: undefined as string | undefined,
  address: undefined as string | undefined,
};

function fixtureState(
  overrides: Partial<typeof child> = {},
  payerAliases: { id: string; alias: string; childId: string; createdAt: string }[] = [],
) {
  return {
    children: [{ ...child, ...overrides }],
    payments: [],
    expenses: [],
    groups: [{ id: 'G1', name: 'Mars', capacity: 10 }],
    categories: [],
    visits: [],
    payerAliases,
  };
}

// eslint-disable-next-line prefer-const
let currentState = fixtureState();

function stubFetch() {
  currentState = fixtureState();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, options?: RequestInit) => {
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
      if (path === '/api/state') return jsonResponse({ state: currentState, revision: 1, updatedAt: '' });
      if (path === '/api/health') return jsonResponse({});
      if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
      if (path === '/api/record' && options?.method === 'POST') {
        const body = JSON.parse(String(options.body));
        currentState = {
          ...currentState,
          children: currentState.children.map(c => (c.id === body.record.id ? body.record : c)),
        };
        return jsonResponse({ state: currentState, revision: (body.revision ?? 1) + 1, updatedAt: '' });
      }
      if (path === '/api/payer-alias-delete' && options?.method === 'POST') {
        const body = JSON.parse(String(options.body));
        currentState = {
          ...currentState,
          payerAliases: currentState.payerAliases.filter(alias => alias.id !== body.id),
        };
        return jsonResponse({ state: currentState, revision: (body.revision ?? 1) + 1, updatedAt: '' });
      }
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

function renderProfile() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <ChildProfileView childId="C1" month="2026-09" onBack={() => {}} onNavigate={() => {}} />
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe('ChildProfileView', () => {
  beforeEach(() => stubFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('eticheta grupei din antet are tonul grupei, nu portocaliu fix (CF-10)', async () => {
    await loadedSession();
    renderProfile();

    await screen.findByText('notă veche');
    const badge = screen.getAllByText('Mars').find(el => el.className.includes('badge'));
    // G1 e prima (singura) grupă din listă -> tonul pozițional e „yellow" (vezi group-tone.test.ts).
    expect(badge?.className).toContain('badge_yellow');
  });

  it('notele existente se arată ca listă, cea mai recentă evidențiată (CF-4)', async () => {
    currentState = fixtureState({
      notes: [
        { id: 'NOTE-2', text: 'notă nouă', date: '2026-09-20' },
        { id: 'NOTE-1', text: 'notă veche', date: '2026-01-01' },
      ],
    });
    await loadedSession();
    renderProfile();

    expect(await screen.findByText('notă nouă')).toBeInTheDocument();
    expect(screen.getByText('notă veche')).toBeInTheDocument();
  });

  it('+ Notă adaugă o notă nouă în capul listei', async () => {
    await loadedSession();
    renderProfile();

    await screen.findByText('notă veche');
    fireEvent.click(screen.getByRole('button', { name: '+ Notă' }));
    const textarea = screen.getByPlaceholderText('Scrie o notă…');
    fireEvent.change(textarea, { target: { value: 'notă proaspătă' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvează' }));

    await waitFor(() => expect(screen.getByText('notă proaspătă')).toBeInTheDocument());
    expect(currentState.children[0].notes[0].text).toBe('notă proaspătă');
  });

  it('cardul Date personale arată IDNP și adresă când sunt completate (CF-2)', async () => {
    currentState = fixtureState({ idnp: '2001234567890', address: 'Str. Ștefan cel Mare 1' });
    await loadedSession();
    renderProfile();

    await screen.findByText('notă veche');
    expect(screen.getByText('Date personale')).toBeInTheDocument();
    expect(screen.getByText('2001234567890')).toBeInTheDocument();
    expect(screen.getByText('Str. Ștefan cel Mare 1')).toBeInTheDocument();
  });

  it('cardul Date personale rămâne vizibil, cu „—”, când IDNP și adresa lipsesc (CF-2)', async () => {
    await loadedSession();
    renderProfile();

    await screen.findByText('notă veche');
    expect(screen.getByText('Date personale')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('cardul Plătitori reținuți arată „niciun plătitor” când lista e goală (CF-2)', async () => {
    await loadedSession();
    renderProfile();

    await screen.findByText('notă veche');
    expect(screen.getByText('Plătitori reținuți')).toBeInTheDocument();
    expect(screen.getByText(/Niciun plătitor reținut\. Se adaugă când bifezi/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Asociere achitări' }).length).toBeGreaterThanOrEqual(1);
  });

  it('cardul Plătitori reținuți arată aliasurile copilului, iar × le șterge din fișă (CF-2)', async () => {
    currentState = fixtureState({}, [
      { id: 'PAY-ALIAS-1', alias: 'Ion Popescu IBAN MD00XYZ', childId: 'C1', createdAt: '2026-09-01T00:00:00.000Z' },
    ]);
    await loadedSession();
    renderProfile();

    expect(await screen.findByText('Ion Popescu IBAN MD00XYZ')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Șterge Ion Popescu IBAN MD00XYZ' }));

    await waitFor(() => expect(screen.queryByText('Ion Popescu IBAN MD00XYZ')).not.toBeInTheDocument());
    expect(currentState.payerAliases).toEqual([]);
  });
});
