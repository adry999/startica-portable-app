import { act, render, renderHook, screen } from '@testing-library/react';
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

function stubFetch() {
  postedPay = [];
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
      if (path.startsWith('/api/personal/salaries?month='))
        return jsonResponse({
          rows: [
            {
              staff: { id: 'STF-1', name: 'Ana Popescu' },
              mode: 'fix',
              base: '10000 lei / lună',
              gross: 10000,
              advances: 0,
              net: 10000,
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
          totals: { gross: 11200, advances: 0, net: 11200, paid: 0 },
        });
      if (path === '/api/personal/salaries/pay' && options?.method === 'POST') {
        const body = JSON.parse(options.body as string);
        postedPay.push(body);
        return jsonResponse({ paid: body.staffIds, skipped: [] });
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
        <SalariesView />
      </ToastProvider>,
    );

    await screen.findByText('Ion Antrenor');
    expect(screen.getByText('Plătit din Bazin')).toBeInTheDocument();
    const checkbox = screen.getByLabelText('Selectează Ion Antrenor');
    expect(checkbox).toBeDisabled();
  });

  it('Plătește trimite id-urile selectate cu metoda aleasă și reîncarcă', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <SalariesView />
      </ToastProvider>,
    );

    await screen.findByText('Ana Popescu');
    await userEvent.click(screen.getByLabelText('Selectează Ana Popescu'));
    await userEvent.selectOptions(screen.getByLabelText('Metoda plății'), 'Card');
    await userEvent.click(screen.getByRole('button', { name: /Plătește/ }));

    expect(await screen.findByText(/plătite/)).toBeInTheDocument();
    expect(postedPay).toHaveLength(1);
    expect(postedPay[0]).toMatchObject({ staffIds: ['STF-1'], method: 'Card' });
  });
});
