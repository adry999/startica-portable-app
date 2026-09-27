import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@shared/ui';
import { SmsMessagesPanel } from './SmsMessagesPanel';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const smsStatus = {
  configured: true,
  sender: 'Startica',
  tokenMasked: '••••1234',
  monthlyLimit: null,
  sentThisMonth: 5,
  failedThisMonth: 1,
  segmentsThisMonth: 6,
  balance: '100.00',
  balanceCheckedAt: '2026-09-27T08:00:00.000Z',
  unitCost: 0.3,
  lastError: '',
};

const deliveredEntry = {
  id: 1,
  createdAt: '2026-09-20T10:00:00.000Z',
  childId: 'c1',
  recipientName: 'Maria',
  childName: 'Ion',
  phone: '+37369123456',
  text: 'Bună, Maria! Rest: 200 lei.',
  templateId: 'TPL-restanta',
  templateName: 'Reamintire restanță',
  month: '2026-09',
  source: 'notify',
  characters: 27,
  segments: 1,
  encoding: 'gsm-7',
  cost: '0.30',
  status: 'delivered',
  providerId: 'p1',
  providerStatus: 'Delivered',
  providerError: '',
  statusCheckedAt: '2026-09-20T11:00:00.000Z',
};

const failedEntry = {
  ...deliveredEntry,
  id: 2,
  childId: 'c2',
  recipientName: 'Elena',
  childName: 'Ana',
  status: 'failed',
  providerError: 'to: Număr invalid.',
};

const retentionExpiredEntry = {
  ...deliveredEntry,
  id: 3,
  childId: 'c3',
  recipientName: 'Dan',
  childName: 'Vlad',
  phone: '',
  text: '',
  status: 'unknown',
  providerError: '',
};

const smsLogPage = {
  entries: [deliveredEntry, failedEntry, retentionExpiredEntry],
  stats: { sentThisMonth: 5, failedThisMonth: 1, segmentsThisMonth: 6, monthlyLimit: null },
  monthly: [
    { month: '2026-09', sent: 4, segments: 5, failed: 1 },
    { month: '2026-08', sent: 10, segments: 12, failed: 2 },
  ],
};

function renderPanel() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <SmsMessagesPanel />
      </ToastProvider>
    </MemoryRouter>,
  );
}

function stubFetch(overrides: Record<string, unknown> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      if (path === '/api/sms-status') return jsonResponse(smsStatus);
      if (path === '/api/sms-refresh-statuses') return jsonResponse({ updated: 0, entries: [] });
      if (path.startsWith('/api/sms-log')) return jsonResponse(overrides.page ?? smsLogPage);
      if (path === '/api/sms-send' && overrides.send)
        return jsonResponse((overrides.send as (init?: RequestInit) => unknown)(init));
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

describe('SmsMessagesPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arată statisticile lunii curente și pastilele „SMS pe luni"', async () => {
    stubFetch();
    renderPanel();

    expect(await screen.findByText('5')).toBeInTheDocument();
    expect(screen.getByText('Trimise luna aceasta')).toBeInTheDocument();
    expect(screen.getByText('SMS pe luni')).toBeInTheDocument();
    expect(screen.getByText('Sep 4')).toBeInTheDocument();
    expect(screen.getByText('Aug 10')).toBeInTheDocument();
  });

  it('clic pe un rând arată panoul de detaliu cu bula mesajului', async () => {
    stubFetch();
    renderPanel();
    const user = userEvent.setup();

    const row = await screen.findByText('Maria');
    await user.click(row);

    expect(screen.getByText('Bună, Maria! Rest: 200 lei.', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Reamintire restanță', { selector: 'dd' })).toBeInTheDocument();
  });

  it('un rând eșuat arată răspunsul furnizorului', async () => {
    stubFetch();
    renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByText('Elena'));

    expect(screen.getByText(/Răspuns furnizor: to: Număr invalid\./)).toBeInTheDocument();
  });

  it('un rând cu datele expirate (retenție) arată „—" și dezactivează Retrimite', async () => {
    stubFetch();
    renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByText('Dan'));

    const retrimite = screen.getByText('Retrimite').closest('button');
    expect(retrimite).toBeDisabled();
  });

  it('„Retrimite" deschide dialogul și trimite cu source resend', async () => {
    const sent: { body: { source?: string } | null } = { body: null };
    stubFetch({
      send: (init?: RequestInit) => {
        sent.body = JSON.parse(String(init?.body ?? '{}'));
        return {
          ok: true,
          results: [{ childId: 'c1', outcome: 'sent', logId: 10, segments: 1, cost: '0.30', error: '' }],
          stopped: null,
          status: smsStatus,
        };
      },
    });
    renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByText('Maria'));
    await user.click(screen.getByText('Retrimite'));
    await user.click(screen.getByText(/Trimite SMS \(≈/));

    expect(await screen.findByText('1 trimise · 0 eșuate · 0 netrimise')).toBeInTheDocument();
    await user.click(screen.getByText('Închide'));
    expect(await screen.findByText('SMS retrimis.')).toBeInTheDocument();
    expect(sent.body?.source).toBe('resend');
  });

  it('„Corectează telefonul" duce către fișa copilului', async () => {
    stubFetch();
    renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByText('Maria'));

    expect(screen.getByText('Corectează telefonul').closest('a')).toHaveAttribute('href', '/copii/c1');
  });

  it('„Toate lunile →" deschide un tabel cu defalcarea lunară, exportabil CSV', async () => {
    stubFetch();
    renderPanel();
    const user = userEvent.setup();

    await screen.findByText('SMS pe luni');
    await user.click(screen.getByText('Toate lunile →'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Exportă CSV')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('row')).toHaveLength(3);
  });

  it('SegmentedControl filtrează local: Eșuate arată doar rândul failed', async () => {
    stubFetch();
    renderPanel();
    const user = userEvent.setup();

    await screen.findByText('Maria');
    await user.click(screen.getByText(/Eșuate ·/));

    expect(screen.queryByText('Maria')).not.toBeInTheDocument();
    expect(screen.getByText('Elena')).toBeInTheDocument();
  });
});
