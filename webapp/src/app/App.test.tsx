import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { ToastProvider } from '@shared/ui';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const emptyState = { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] };

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: emptyState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  it('pornește pe Dashboard, în interiorul shell-ului', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </MemoryRouter>,
    );
    // Shell-ul (sidebar, antet) apare abia după ce sesiunea are snapshot-ul — vezi StartupScreen (21a).
    expect(await screen.findByRole('heading', { name: 'Rezumatul lunii' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dashboard/ })).toHaveAttribute('aria-current', 'page');
  });

  it('navigarea din sidebar schimbă conținutul', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Vizite' }));
    expect(screen.getByRole('heading', { name: 'Vizite' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Programează vizită' })).toBeInTheDocument();
  });

  it('/copii/zile-de-nastere e ecranul Zile de naștere, nu fișa unui copil cu acest id', async () => {
    render(
      <MemoryRouter initialEntries={['/copii/zile-de-nastere']}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Zile de naștere' })).toBeInTheDocument();
    expect(screen.queryByText('Fișa nu a putut fi găsită.')).not.toBeInTheDocument();
  });

  it('o cale necunoscută revine la Dashboard', async () => {
    render(
      <MemoryRouter initialEntries={['/ceva-inexistent']}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Rezumatul lunii' })).toBeInTheDocument();
  });

  describe('40a: „Plată +” din Situația plăților', () => {
    const statusFixture = {
      children: [
        {
          id: 'c1',
          name: 'Andrei Popescu',
          contractDate: '2026-01-01',
          attendanceDate: '2026-01-01',
          status: 'Activ',
          statusHistory: [],
          feeHistory: [{ from: '2026-01', amount: 1500 }],
          archived: false,
        },
      ],
      payments: [],
      expenses: [],
      groups: [],
      categories: [],
      visits: [],
    };
    let currentPayments: Record<string, unknown>[] = [];

    beforeEach(() => {
      currentPayments = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (path: string, init?: RequestInit) => {
          if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
          if (path === '/api/state')
            return jsonResponse({
              state: { ...statusFixture, payments: currentPayments },
              revision: 1,
              updatedAt: '2026-09-23T10:00:00Z',
            });
          if (path === '/api/health') return jsonResponse({});
          if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
          if (path === '/api/kindergarten') return jsonResponse({ name: 'Startica', idno: '' });
          if (path === '/api/sms-status')
            return jsonResponse({
              configured: false,
              sender: '',
              tokenMasked: '',
              monthlyLimit: null,
              sentThisMonth: 0,
              failedThisMonth: 0,
              segmentsThisMonth: 0,
              balance: null,
              balanceCheckedAt: '',
              unitCost: 0.3,
              lastError: '',
            });
          if (path === '/api/sms-last-notified') return jsonResponse({});
          if (path === '/api/sms-templates') return jsonResponse({ templates: [], usageCountById: {} });
          if (path === '/api/record') {
            const body = JSON.parse(String(init?.body ?? '{}'));
            currentPayments = [...currentPayments, body.record];
            return jsonResponse({
              state: { ...statusFixture, payments: currentPayments },
              revision: 2,
              updatedAt: '2026-09-23T10:05:00Z',
            });
          }
          throw new Error(`neașteptat: ${path}`);
        }),
      );
    });

    it('deschide PaymentFormDrawer cu copilul rândului, salvează și rămâne pe Situația plăților', async () => {
      render(
        <MemoryRouter initialEntries={['/situatia-platilor']}>
          <ToastProvider>
            <App />
          </ToastProvider>
        </MemoryRouter>,
      );

      expect(await screen.findByRole('heading', { name: 'Situația plăților' })).toBeInTheDocument();
      const user = userEvent.setup();
      const row = screen.getByText('Andrei Popescu').closest('tr') as HTMLElement;

      await user.click(within(row).getByRole('button', { name: 'Plată +' }));
      const drawer = await screen.findByRole('dialog', { name: 'Achitare nouă' });
      expect(within(drawer).getByText('Andrei Popescu')).toBeInTheDocument();

      // F11: suma pornește precompletată cu taxa lunii (1.500,00) — salvăm direct, fără să o schimbăm.
      await user.click(screen.getByRole('button', { name: /^Salvează/ }));

      await screen.findByText('Achitare adăugată.');
      // Rămânem pe Situația plăților — nu s-a navigat în alt modul (fără reîncărcarea tabelului).
      expect(screen.getByRole('heading', { name: 'Situația plăților' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Achitare nouă' })).not.toBeInTheDocument();
    });
  });
});
