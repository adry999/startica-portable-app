import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    <ToastProvider>
      <NotificationsPage />
    </ToastProvider>,
  );
}

describe('NotificationsPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
});
