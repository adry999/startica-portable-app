import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@shared/ui';
import { SmsProviderCard } from './SmsProviderCard';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function renderCard() {
  return render(
    <ToastProvider>
      <SmsProviderCard />
    </ToastProvider>,
  );
}

const unconfigured = {
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
};

const configured = {
  configured: true,
  sender: 'Startica',
  tokenMasked: '••••1234',
  monthlyLimit: null,
  sentThisMonth: 12,
  failedThisMonth: 1,
  segmentsThisMonth: 14,
  balance: '120.00',
  balanceCheckedAt: '2026-09-27T08:00:00.000Z',
  unitCost: 0.3,
  lastError: '',
};

describe('SmsProviderCard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arată badge Neconectat și câmpul cheii API când nu e configurat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/sms-status') return jsonResponse(unconfigured);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderCard();

    expect(await screen.findByText('Neconectat')).toBeInTheDocument();
    expect(screen.getByLabelText('Cheie API')).toBeInTheDocument();
  });

  it('ascunde cheia API când e configurat, dar o arată din nou după „Schimbă"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/sms-status') return jsonResponse(configured);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderCard();
    const user = userEvent.setup();

    expect(await screen.findByText('Conectat')).toBeInTheDocument();
    expect(screen.getByText('••••1234')).toBeInTheDocument();
    expect(screen.queryByLabelText('Cheie API')).not.toBeInTheDocument();

    await user.click(screen.getByText('Schimbă'));
    expect(screen.getByLabelText('Cheie API')).toBeInTheDocument();
  });

  it('bifarea limitei lunare arată câmpul numeric; salvarea fără bifă trimite monthlyLimit null', async () => {
    const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
      if (path === '/api/sms-status') return jsonResponse(configured);
      if (path === '/api/sms-connect') {
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body.monthlyLimit).toBeNull();
        return jsonResponse({ ok: true });
      }
      throw new Error(`neașteptat: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderCard();
    const user = userEvent.setup();

    await screen.findByText('Conectat');
    expect(screen.queryByLabelText('Limită lunară')).not.toBeInTheDocument();

    await user.click(screen.getByText('Salvează'));
    expect(fetchMock).toHaveBeenCalledWith('/api/sms-connect', expect.anything());
  });

  it('bifarea limitei lunare și salvarea trimit valoarea numerică', async () => {
    const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
      if (path === '/api/sms-status') return jsonResponse(configured);
      if (path === '/api/sms-connect') {
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body.monthlyLimit).toBe(500);
        return jsonResponse({ ok: true });
      }
      throw new Error(`neașteptat: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderCard();
    const user = userEvent.setup();

    await screen.findByText('Conectat');
    await user.click(screen.getByLabelText('Activează limita lunară'));
    const limitInput = screen.getByLabelText('Limită lunară');
    await user.clear(limitInput);
    await user.type(limitInput, '500');
    await user.click(screen.getByText('Salvează'));

    expect(fetchMock).toHaveBeenCalledWith('/api/sms-connect', expect.anything());
  });

  it('„Trimite SMS de test" cere telefonul și îl trimite la /api/sms-test', async () => {
    const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
      if (path === '/api/sms-status') return jsonResponse(configured);
      if (path === '/api/sms-test') {
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body.phone).toBe('+37369000000');
        return jsonResponse({ ok: true });
      }
      throw new Error(`neașteptat: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderCard();
    const user = userEvent.setup();

    await screen.findByText('Conectat');
    await user.click(screen.getByText('Trimite SMS de test'));
    await user.type(screen.getByLabelText('Telefon pentru test'), '+37369000000');
    await user.click(screen.getByText('costă 1 SMS (≈ 0,30 lei)', { exact: false }));

    expect(fetchMock).toHaveBeenCalledWith('/api/sms-test', expect.anything());
  });

  it('un 400 la conectare (cheie invalidă) arată eroarea, nu doar butonul reactivat (M7)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/sms-status') return jsonResponse(unconfigured);
        if (path === '/api/sms-connect')
          return { ok: false, status: 400, json: async () => ({ error: 'Cheia API nu e validă.' }) };
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderCard();
    const user = userEvent.setup();

    await screen.findByText('Neconectat');
    await user.type(screen.getByLabelText('Cheie API'), 'gresit');
    await user.click(screen.getByText('Conectează'));

    expect(await screen.findByRole('status')).toHaveTextContent('Cheia API nu e validă.');
  });
});
