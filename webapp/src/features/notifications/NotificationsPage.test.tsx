import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@shared/ui';
import { NotificationsPage } from './NotificationsPage';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const unconfigured = {
  configured: false,
  connected: false,
  chatName: '',
  botUsername: '',
  lastRun: '',
  lastSuccess: '',
  lastError: '',
  stale: false,
};

const preferences = {
  birthdaysEnabled: true,
  birthdaysDaysBefore: 2,
  visitsEnabled: true,
  visitsHorizonDays: 1,
  overdueEnabled: true,
  overdueCadence: 'monday',
  nothingToReportEnabled: true,
  digestTime: '08:00',
  windowsVisitsTodayEnabled: true,
  windowsVisitSoonEnabled: true,
  windowsVisitSoonMinutes: 30,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <NotificationsPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

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

const smsConfigured = {
  ...smsUnconfigured,
  configured: true,
  sender: 'Startica',
  tokenMasked: '••••1234',
};

const defaultTemplate = {
  id: 't1',
  name: 'Reamintire restanță',
  body: 'Bună, {părinte}!',
  stripDiacritics: true,
  isDefault: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const customTemplate = {
  id: 't2',
  name: 'Personalizat',
  body: 'Text liber',
  stripDiacritics: false,
  isDefault: false,
  createdAt: '2026-09-10T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z',
};

const emptyState = { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] };

const emptySmsLogPage = {
  entries: [],
  stats: { sentThisMonth: 0, failedThisMonth: 0, segmentsThisMonth: 0, monthlyLimit: null },
  monthly: [],
};

function stubFullFetch(smsStatusBody: unknown = smsUnconfigured) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/telegram-status') return jsonResponse(unconfigured);
      if (path === '/api/notification-settings') return jsonResponse(preferences);
      if (path === '/api/sms-status') return jsonResponse(smsStatusBody);
      if (path === '/api/sms-templates') return jsonResponse({ templates: [defaultTemplate, customTemplate] });
      if (path === '/api/sms-refresh-statuses') return jsonResponse({ updated: 0, entries: [] });
      if (path.startsWith('/api/sms-log')) return jsonResponse(emptySmsLogPage);
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
      if (path === '/api/state')
        return jsonResponse({ state: emptyState, revision: 1, updatedAt: '2026-09-27T10:00:00Z' });
      if (path === '/api/health') return jsonResponse({});
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

describe('NotificationsPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('arată formularul de conectare Telegram și preferințele salvate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/telegram-status') return jsonResponse(unconfigured);
        if (path === '/api/notification-settings') return jsonResponse(preferences);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderPage();

    expect(await screen.findByText('Conectează')).toBeInTheDocument();
    expect(await screen.findByText('Zile de naștere')).toBeInTheDocument();
    expect(screen.queryByText('Salvează preferințele')).not.toBeInTheDocument();
  });

  it('schimbarea unei preferințe arată bara de salvare', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/telegram-status') return jsonResponse(unconfigured);
        if (path === '/api/notification-settings' && !init?.body) return jsonResponse(preferences);
        if (path === '/api/notification-settings') return jsonResponse({ ...preferences, digestTime: '09:00' });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderPage();
    const user = userEvent.setup();

    const digestInput = await screen.findByDisplayValue('08:00');
    await user.clear(digestInput);
    await user.type(digestInput, '09:00');

    expect(await screen.findByText('Salvează preferințele')).toBeInTheDocument();

    await user.click(screen.getByText('Salvează preferințele'));
    expect(await screen.findByText('Preferințele au fost salvate.')).toBeInTheDocument();
  });

  it('comutarea pe „Șabloane" arată șablonul implicit și cardul Furnizor SMS', async () => {
    stubFullFetch();
    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Conectează');
    await user.click(screen.getByText('Șabloane'));

    expect(await screen.findByText('Reamintire restanță')).toBeInTheDocument();
    expect(screen.getByText('Furnizor SMS')).toBeInTheDocument();
  });

  it('comutarea pe „Mesaje SMS" arată statisticile lunii și lista goală', async () => {
    stubFullFetch();
    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Conectează');
    await user.click(screen.getByText('Mesaje SMS'));

    expect(await screen.findByText('Trimise luna aceasta')).toBeInTheDocument();
    expect(screen.getByText('Niciun SMS pentru filtrele alese.')).toBeInTheDocument();
  });

  it('cheia API nu apare când sms.md e deja configurat, doar tokenul mascat', async () => {
    stubFullFetch(smsConfigured);
    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Conectează');
    await user.click(screen.getByText('Șabloane'));

    expect(await screen.findByText('••••1234')).toBeInTheDocument();
    expect(screen.queryByLabelText('Cheie API')).not.toBeInTheDocument();

    await user.click(screen.getByText('Schimbă'));
    expect(screen.getByLabelText('Cheie API')).toBeInTheDocument();
  });
});
