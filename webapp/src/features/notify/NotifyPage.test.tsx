import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { NotifyPage } from './NotifyPage';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = {
  children: [
    {
      id: 'c1',
      name: 'Andrei Popescu',
      parent: 'Maria Popescu',
      // Numărul e format valid moldovenesc (069xxxxxx), ca destinatarul SMS să fie ales de chooseSmsRecipient.
      phone: '069000000',
      contractDate: '2026-01-05',
      attendanceDate: '2026-01-05',
      status: 'Activ',
      statusHistory: [],
      feeHistory: [{ from: '2026-01', amount: 1500 }],
      groupId: null,
      archived: false,
    },
  ],
  payments: [],
  expenses: [],
  groups: [],
  categories: [],
  visits: [],
};

const smsUnconfigured = {
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

const smsConfigured = { ...smsUnconfigured, configured: true, sender: 'Startica' };

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <NotifyPage month="2026-09" onNavigate={() => {}} />
      </ToastProvider>
    </MemoryRouter>,
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('NotifyPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/sms-status') return jsonResponse(smsUnconfigured);
        if (path === '/api/sms-last-notified') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    localStorage.clear();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arată un mesaj de încărcare înainte ca sesiunea să fie gata', () => {
    renderPage();
    expect(screen.getByText('Se încarcă datele…')).toBeInTheDocument();
  });

  it('arată copilul restanțier și contactul lui', async () => {
    await loadedSession();
    renderPage();

    expect(await screen.findByText('Andrei Popescu')).toBeInTheDocument();
    expect(screen.getByText('Maria Popescu')).toBeInTheDocument();
  });

  it('"Copiază toate mesajele" copiază în clipboard și arată un toast', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Andrei Popescu');
    await user.click(screen.getByText('Copiază toate mesajele'));

    expect(await screen.findByText('1 mesaje copiate.')).toBeInTheDocument();
  });

  it('"Copiază" pe rând copiază mesajul acelui rând (regresie)', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Andrei Popescu');
    await user.click(screen.getByText('Copiază'));

    expect(await screen.findByText('Mesaj copiat.')).toBeInTheDocument();
  });

  it('arată „Trimite tuturor · 1" în antet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/sms-status') return jsonResponse(smsConfigured);
        if (path === '/api/sms-last-notified') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    await loadedSession();
    renderPage();

    expect(await screen.findByText('Trimite tuturor · 1')).toBeInTheDocument();
  });

  it('cu sms.md neconfigurat, butoanele de trimitere sunt dezactivate', async () => {
    await loadedSession();
    renderPage();

    await screen.findByText('Andrei Popescu');
    const sendButton = screen.getByText('Trimite SMS');
    expect(sendButton.closest('button')).toBeDisabled();
    expect(sendButton.closest('button')).toHaveAttribute('title', 'Conectează sms.md în Notificări');
  });

  it('"Trimite SMS" pe rând deschide dialogul cu numele copilului', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/sms-status') return jsonResponse(smsConfigured);
        if (path === '/api/sms-last-notified') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Andrei Popescu');
    await user.click(screen.getByText('Trimite SMS'));

    expect(screen.getAllByText('Andrei Popescu').length).toBeGreaterThan(1);
    expect(screen.getByText(/Trimite SMS \(≈/)).toBeInTheDocument();
  });

  it('o trimitere reușită arată toast-ul și marchează rândul „Notificat azi"', async () => {
    let notified = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/sms-status') return jsonResponse(smsConfigured);
        if (path === '/api/sms-last-notified')
          return jsonResponse(
            notified
              ? { c1: { at: new Date().toISOString(), status: 'sent', month: '2026-09', templateName: 'Implicit' } }
              : {},
          );
        if (path === '/api/sms-send') {
          notified = true;
          return jsonResponse({
            ok: true,
            results: [{ childId: 'c1', outcome: 'sent', logId: 1, segments: 1, cost: '0.30', error: '' }],
            stopped: null,
            status: smsConfigured,
          });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Andrei Popescu');
    await user.click(screen.getByText('Trimite SMS'));
    await user.click(screen.getByText(/Trimite SMS \(≈/));

    expect(await screen.findByText('1 trimise · 0 eșuate · 0 netrimise')).toBeInTheDocument();
    await user.click(screen.getByText('Închide'));

    expect(await screen.findByText('SMS trimis către Maria Popescu')).toBeInTheDocument();
    expect(await screen.findByText('Notificat azi')).toBeInTheDocument();
  });
});
