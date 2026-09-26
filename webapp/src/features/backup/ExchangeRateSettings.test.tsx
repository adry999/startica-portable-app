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
  });

  it('arată "Preia de la BNM" când nu există curs azi, iar preluarea reușită afișează toast', async () => {
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

    await screen.findByText('Fără curs azi');
    await user.click(screen.getByText('Preia de la BNM'));

    expect(await screen.findByText('Cursul BNM a fost actualizat.')).toBeInTheDocument();
    const todayRow = screen.getByTestId('today-rate');
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

    await screen.findByTestId('today-rate');
    await user.type(screen.getByLabelText('Corectează cursul de azi'), '20.10');
    await user.click(screen.getByText('Salvează'));

    expect(await screen.findByText('Cursul de azi a fost corectat.')).toBeInTheDocument();
    const todayRow = screen.getByTestId('today-rate');
    expect(within(todayRow).getByText(/1 € = 20,1000 lei/)).toBeInTheDocument();
    expect(within(todayRow).getByText('Revino la cursul BNM')).toBeInTheDocument();
  });

  it('adaugă o presetare de plan și o salvează', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        const isPost = init?.method === 'POST';
        if (path === '/api/exchange-rates' && !isPost) return jsonResponse({ rates: {}, sources: {} });
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

    await screen.findByText('Nicio presetare adăugată încă.');
    await user.click(screen.getByText('+ Adaugă presetare'));

    await user.type(screen.getByLabelText('Nume presetare'), 'Program standard');
    await user.clear(screen.getByLabelText('Preț presetare în euro'));
    await user.type(screen.getByLabelText('Preț presetare în euro'), '150');

    await user.click(screen.getByText('Salvează presetările'));

    await waitFor(() => expect(screen.getByText('Presetările de plan au fost salvate.')).toBeInTheDocument());
  });
});
