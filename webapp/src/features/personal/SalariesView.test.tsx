import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { reloadPersonal } from '@shared/personal/usePersonal';
import { SalariesView } from './SalariesView';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

const fixturePersonalState = {
  departments: [{ id: 'DEP-1', name: 'Educatori', order: 1 }],
  roles: [{ id: 'ROL-1', name: 'Educator', departmentId: 'DEP-1', order: 1 }],
  staff: [
    {
      id: 'STF-1',
      name: 'Ana Popescu',
      roleId: 'ROL-1',
      branchIds: ['bu'],
      phone: '',
      since: '2020-01-01',
      archivedAt: null,
      notes: [],
    },
    {
      id: 'STF-2',
      name: 'Ion Antrenor',
      roleId: 'ROL-1',
      branchIds: ['bu'],
      phone: '',
      since: '2020-01-01',
      archivedAt: null,
      notes: [],
    },
  ],
  settings: { annualLeaveDays: 28, deductOnlyUnexcused: true },
};

let postedPay: unknown[] = [];
let postedAdvances: unknown[] = [];
// M8: al doilea răspuns la /api/personal/salaries?month= trebuie să reflecte avansul dat —
// altfel testul de reîncărcare automată ar trece și fără fix.
let salariesLoadCount = 0;
// A3f: un test înlocuiește rândurile implicite ca să verifice un angajat fără salariu setat (mode: null).
let salariesRowsOverride: unknown[] | null = null;

function stubFetch() {
  postedPay = [];
  postedAdvances = [];
  salariesLoadCount = 0;
  salariesRowsOverride = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, options?: RequestInit) => {
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3', branch: null, branches: [] });
      if (path === '/api/state')
        return jsonResponse({
          state: { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] },
          revision: 1,
          updatedAt: '2026-09-23T10:00:00Z',
        });
      if (path === '/api/health') return jsonResponse({});
      if (path === '/api/personal/state') return jsonResponse(fixturePersonalState);
      if (path === '/api/personal/pin') return jsonResponse({ configured: true, unlocked: true });
      if (path.startsWith('/api/personal/salaries?month=')) {
        salariesLoadCount += 1;
        const advances = salariesLoadCount >= 2 ? 500 : 0;
        if (salariesRowsOverride) {
          return jsonResponse({
            rows: salariesRowsOverride,
            totals: { gross: 0, advances: 0, net: 0, paid: 0 },
          });
        }
        return jsonResponse({
          rows: [
            {
              staff: { id: 'STF-1', name: 'Ana Popescu' },
              mode: 'fix',
              base: '10000 lei / lună',
              gross: 10000,
              advances,
              net: 10000 - advances,
              paid: null,
            },
            {
              staff: { id: 'STF-2', name: 'Ion Antrenor' },
              mode: 'bazin',
              base: 'de închis în Bazin',
              gross: 1200,
              advances: 0,
              net: 1200,
              paid: null,
            },
          ],
          totals: { gross: 11200, advances, net: 11200 - advances, paid: 0 },
        });
      }
      if (path === '/api/personal/salaries/pay' && options?.method === 'POST') {
        const body = JSON.parse(options.body as string);
        postedPay.push(body);
        return jsonResponse({ paid: body.staffIds, skipped: [] });
      }
      if (path === '/api/personal/advances' && options?.method === 'POST') {
        const body = JSON.parse(options.body as string);
        postedAdvances.push(body);
        return jsonResponse({ advance: { id: 'ADV-1', ...body.advance } });
      }
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('SalariesView', () => {
  beforeEach(() => stubFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('rândul unui antrenor de bazin arată „Plătit din Bazin” și nu se poate selecta', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <SalariesView month="2026-08" />
      </ToastProvider>,
    );

    await screen.findByText('Ion Antrenor');
    expect(screen.getByText('Din Bazin')).toBeInTheDocument();
    const checkbox = screen.getByLabelText('Selectează Ion Antrenor');
    expect(checkbox).toBeDisabled();
  });

  it('Plătește deschide o confirmare cu totalul, apoi trimite id-urile selectate cu metoda aleasă', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <SalariesView month="2026-08" />
      </ToastProvider>,
    );

    await screen.findByText('Ana Popescu');
    await userEvent.click(screen.getByLabelText('Selectează Ana Popescu'));
    await userEvent.click(screen.getByRole('button', { name: /^Plătește 1 selectați$/ }));

    const dialog = screen.getByRole('dialog', { name: 'Confirmă plata' });
    expect(within(dialog).getByText('10.000,00 lei')).toBeInTheDocument();
    await userEvent.selectOptions(within(dialog).getByLabelText('Metoda plății'), 'Card');
    await userEvent.click(within(dialog).getByRole('button', { name: /^Plătește ·/ }));

    expect(await screen.findByText(/plătite/)).toBeInTheDocument();
    expect(postedPay).toHaveLength(1);
    expect(postedPay[0]).toMatchObject({ staffIds: ['STF-1'], method: 'Card' });
  });

  it('clic pe un rând deschide istoricul angajatului (23c)', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <SalariesView month="2026-08" />
      </ToastProvider>,
    );

    await userEvent.click(await screen.findByText('Ana Popescu'));
    expect(await screen.findByRole('heading', { name: 'Istoric salariu: Ana Popescu' })).toBeInTheDocument();
  });

  it('un angajat fără salariu setat apare cu „+ Setează salariul”, nebifabil', async () => {
    await loadedSession();
    await act(() => reloadPersonal());
    salariesRowsOverride = [
      {
        staff: { id: 'STF-3', name: 'Elena Croitoru' },
        mode: null,
        base: '',
        gross: null,
        advances: 0,
        net: null,
        paid: null,
      },
    ];

    render(
      <ToastProvider>
        <SalariesView month="2026-08" />
      </ToastProvider>,
    );

    await screen.findByText('Elena Croitoru');
    expect(screen.getByText('Fără salariu setat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Setează salariul' })).toBeInTheDocument();
    expect(screen.getByLabelText('Selectează Elena Croitoru')).toBeDisabled();
  });

  it('după un avans dat, lista se reîncarcă automat și cardul „Avansuri” se actualizează (M8)', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <SalariesView month="2026-08" />
      </ToastProvider>,
    );

    await screen.findByText('Ana Popescu');
    const advancesCard = screen.getByText('Avansuri date', { selector: 'span' }).closest('div')!;
    expect(within(advancesCard).getByText('0,00 lei')).toBeInTheDocument();

    const row = screen.getByText('Ana Popescu').closest('div')!;
    await userEvent.click(within(row).getByLabelText('Mai multe acțiuni'));
    await userEvent.click(within(row).getByRole('button', { name: 'Avans' }));

    const dialog = screen.getByRole('dialog', { name: 'Avans: Ana Popescu' });
    await userEvent.type(within(dialog).getByLabelText('Sumă (lei)'), '500');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvează' }));

    expect(await screen.findByText('Avansul a fost înregistrat.')).toBeInTheDocument();
    expect(postedAdvances).toHaveLength(1);
    // M8: fără onSaved={salaries.reload}, cardul ar fi rămas la 0,00 lei — al doilea răspuns
    // mocat (500) nu ar mai fi fost cerut deloc. Reinterogăm DOM-ul la fiecare încercare —
    // load() trece prin 'loading' (LoadingState înlocuiește tot ecranul), deci `advancesCard`
    // de mai sus devine un nod desprins de document după reîncărcare.
    await waitFor(() => {
      const card = screen.getByText('Avansuri date', { selector: 'span' }).closest('div')!;
      expect(within(card).getByText('500,00 lei')).toBeInTheDocument();
    });
  });
});
