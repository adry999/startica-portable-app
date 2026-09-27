import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@shared/ui';
import { today } from '@domain/calendar-month.mjs';
import { ExchangeRateSettings } from './ExchangeRateSettings';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const todayDate = today();

function renderComponent() {
  return render(
    <ToastProvider>
      <ExchangeRateSettings />
    </ToastProvider>,
  );
}

describe('ExchangeRateSettings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arată cursul de azi (BNM) fără butonul de revenire', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        const isPost = init?.method === 'POST';
        if (path === '/api/exchange-rates' && !isPost)
          return jsonResponse({ rates: { [todayDate]: 19.62 }, sources: { [todayDate]: 'bnm' } });
        if (path === '/api/plan-presets' && !isPost) return jsonResponse([]);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderComponent();

    const todayRow = await screen.findByTestId('today-rate');
    expect(within(todayRow).getByText(/1 € = 19,6200 lei/)).toBeInTheDocument();
    expect(within(todayRow).queryByText('Revino la cursul BNM')).not.toBeInTheDocument();
    expect(within(todayRow).getByText('Corectează cursul de azi')).toBeInTheDocument();
  });

  it('arată "Preia de la BNM" când nu există niciun curs, iar preluarea reușită afișează toast', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        const isPost = init?.method === 'POST';
        if (path === '/api/exchange-rates' && !isPost) return jsonResponse({ rates: {}, sources: {} });
        if (path === '/api/plan-presets' && !isPost) return jsonResponse([]);
        if (path === '/api/exchange-rates/refresh')
          return jsonResponse({ ok: true, rates: { [todayDate]: 19.7 }, sources: { [todayDate]: 'bnm' } });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderComponent();
    const user = userEvent.setup();

    const todayRow = await screen.findByTestId('today-rate');
    expect(within(todayRow).getByText('Fără curs cunoscut')).toBeInTheDocument();
    await user.click(within(todayRow).getByText('Preia de la BNM'));

    expect(await screen.findByText('Cursul BNM a fost actualizat.')).toBeInTheDocument();
    expect(within(todayRow).getByText(/1 € = 19,7000 lei/)).toBeInTheDocument();
  });

  it('corectarea cursului de azi trimite cererea și arată tonul galben cu butonul de revenire', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        const isPost = init?.method === 'POST';
        if (path === '/api/exchange-rates' && !isPost)
          return jsonResponse({ rates: { [todayDate]: 19.62 }, sources: { [todayDate]: 'bnm' } });
        if (path === '/api/plan-presets' && !isPost) return jsonResponse([]);
        if (path === '/api/exchange-rates' && isPost) {
          const body = JSON.parse(String(init?.body ?? '{}'));
          return jsonResponse({ rates: { [todayDate]: body.rate }, sources: { [todayDate]: 'manual' } });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderComponent();
    const user = userEvent.setup();

    const todayRow = await screen.findByTestId('today-rate');
    await user.click(within(todayRow).getByText('Corectează cursul de azi'));
    await user.type(screen.getByLabelText('Curs'), '20.10');
    await user.click(screen.getByText('Salvează cursul'));

    expect(await screen.findByText('Cursul de azi a fost corectat.')).toBeInTheDocument();
    expect(within(todayRow).getByText(/1 € = 20,1000 lei/)).toBeInTheDocument();
    expect(within(todayRow).getByText('Revino la cursul BNM')).toBeInTheDocument();
  });

  it('anularea corectării ascunde formularul fără să trimită nimic', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        const isPost = init?.method === 'POST';
        if (path === '/api/exchange-rates' && !isPost)
          return jsonResponse({ rates: { [todayDate]: 19.62 }, sources: { [todayDate]: 'bnm' } });
        if (path === '/api/plan-presets' && !isPost) return jsonResponse([]);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderComponent();
    const user = userEvent.setup();

    const todayRow = await screen.findByTestId('today-rate');
    await user.click(within(todayRow).getByText('Corectează cursul de azi'));
    expect(screen.getByLabelText('Curs')).toBeInTheDocument();

    await user.click(screen.getByText('Anulează'));
    expect(screen.queryByLabelText('Curs')).not.toBeInTheDocument();
  });

  it('adaugă un plan cu orar și descriere și îl salvează', async () => {
    // Patru câmpuri completate pe rând (nume, orar, descriere, preț) trec peste timeout-ul implicit de 5s.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        const isPost = init?.method === 'POST';
        if (path === '/api/exchange-rates' && !isPost)
          return jsonResponse({ rates: { [todayDate]: 19.62 }, sources: { [todayDate]: 'bnm' } });
        if (path === '/api/plan-presets' && !isPost) return jsonResponse([]);
        if (path === '/api/plan-presets' && isPost) {
          const body = JSON.parse(String(init?.body ?? '[]'));
          return jsonResponse(body);
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderComponent();
    const user = userEvent.setup();

    await screen.findByText('Niciun plan adăugat încă.');
    await user.click(screen.getByText('+ Adaugă plan'));

    await user.type(screen.getByLabelText('Nume plan'), 'Program mediu');
    await user.type(screen.getByLabelText('Orarul planului'), '8:00–17:00');
    await user.type(screen.getByLabelText('Descrierea planului'), 'Toate mesele, somn de zi.');
    await user.clear(screen.getByLabelText('Preț lunar în euro'));
    await user.type(screen.getByLabelText('Preț lunar în euro'), '350');

    expect(screen.getByText('≈ 6.867,00 lei')).toBeInTheDocument();

    await user.click(screen.getByText('Salvează planurile'));

    await waitFor(() => expect(screen.getByText('Planurile au fost salvate.')).toBeInTheDocument());
  }, 10000);

  it('Renunță revine la ultima listă salvată de planuri', async () => {
    const initialPresets = [{ id: 'PLAN-1', name: 'Program mediu', priceEur: 350 }];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        const isPost = init?.method === 'POST';
        if (path === '/api/exchange-rates' && !isPost) return jsonResponse({ rates: {}, sources: {} });
        if (path === '/api/plan-presets' && !isPost) return jsonResponse(initialPresets);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderComponent();
    const user = userEvent.setup();

    await screen.findByDisplayValue('Program mediu');
    await user.click(screen.getByText('+ Adaugă plan'));
    expect(screen.getAllByLabelText('Nume plan')).toHaveLength(2);

    await user.click(screen.getByText('Renunță'));
    expect(screen.getAllByLabelText('Nume plan')).toHaveLength(1);
  });
});
