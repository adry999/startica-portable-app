import { render, renderHook, act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider, TopbarActionsProvider, useTopbarActionsSlot } from '@shared/ui';
import { today as todayFn } from '@domain/calendar-month.mjs';
import { StatusPage } from './StatusPage';

/** Randează slot-ul de antet ca Topbar-ul real — comutatorul de mod ajunge acolo, nu în pagină. */
function TopbarActionsSlot() {
  return <>{useTopbarActionsSlot()}</>;
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// Aceeași fixtură ca useStatus.test.ts: restanță (c1), retras fără obligație (c2),
// fără taxă completată (c3), plătit integral și cu grupă (c4) — aceleași cifre pe carduri.
const fixtureState = {
  children: [
    {
      id: 'c1',
      name: 'Andrei Popescu',
      contractDate: '2026-01-10',
      attendanceDate: '2026-01-10',
      withdrawalDate: null,
      status: 'Activ',
      statusHistory: [],
      feeHistory: [{ from: '2026-01', amount: 1500 }],
      parent: 'Maria Popescu',
      // Numărul e format valid moldovenesc (069xxxxxx), ca destinatarul SMS să fie ales de chooseSmsRecipient.
      phone: '069000000',
      archived: false,
    },
    {
      id: 'c2',
      name: 'Maria Ionescu',
      contractDate: '2026-01-05',
      attendanceDate: '2026-01-05',
      withdrawalDate: '2026-08-31',
      status: 'Retras',
      statusHistory: [],
      feeHistory: [{ from: '2026-01', amount: 1200 }],
      archived: true,
    },
    {
      id: 'c3',
      name: 'Ion Radu',
      contractDate: '2026-02-01',
      attendanceDate: '2026-02-01',
      withdrawalDate: null,
      status: 'Activ',
      statusHistory: [],
      feeHistory: [],
      archived: false,
    },
    {
      id: 'c4',
      name: 'Elena Marin',
      contractDate: '2026-01-15',
      attendanceDate: '2026-01-15',
      withdrawalDate: null,
      status: 'Activ',
      statusHistory: [],
      feeHistory: [{ from: '2026-01', amount: 1000 }],
      groupId: 'g1',
      archived: false,
    },
  ],
  payments: [
    {
      id: 'p1',
      date: '2026-09-10',
      childId: 'c1',
      amount: 500,
      tenders: [{ method: 'Cash', amount: 500 }],
      allocations: [{ month: '2026-09', amount: 500 }],
      archived: false,
    },
    {
      id: 'p2',
      date: '2026-09-02',
      childId: 'c4',
      amount: 1000,
      tenders: [{ method: 'Card', amount: 1000 }],
      allocations: [{ month: '2026-09', amount: 1000 }],
      archived: false,
    },
  ],
  expenses: [],
  groups: [{ id: 'g1', name: 'Fluturași', capacity: null }],
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
  const onMonthChange = vi.fn();
  const onNavigate = vi.fn();
  const onOpenChild = vi.fn();
  render(
    <MemoryRouter>
      <ToastProvider>
        <TopbarActionsProvider>
          <TopbarActionsSlot />
          <StatusPage month="2026-09" onMonthChange={onMonthChange} onNavigate={onNavigate} onOpenChild={onOpenChild} />
        </TopbarActionsProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
  return { onMonthChange, onNavigate, onOpenChild };
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('StatusPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
        if (path === '/api/kindergarten') return jsonResponse({ name: 'Startica', idno: '' });
        if (path === '/api/sms-status') return jsonResponse(smsUnconfigured);
        if (path === '/api/sms-last-notified') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arată starea de încărcare înainte ca sesiunea să fie gata', () => {
    vi.useFakeTimers();
    try {
      renderPage();
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByRole('status', { name: 'Se încarcă…' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('randează tabelul cu obligația fiecărui copil', async () => {
    await loadedSession();
    renderPage();

    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument();
    expect(screen.getByText('Restanță')).toBeInTheDocument();
  });

  it('butonul de tipărire deschide dialogul, apoi declanșează window.print', async () => {
    await loadedSession();
    renderPage();

    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Tipărește' }));

    const dialog = screen.getByRole('dialog', { name: 'Tipărește situația plăților' });
    await user.click(within(dialog).getByRole('button', { name: 'Tipărește' }));

    await vi.waitFor(() => expect(printSpy).toHaveBeenCalled());
  });

  it('antetul are comutatorul Lună | An școlar și selectorul de lună în modul Lună', async () => {
    await loadedSession();
    renderPage();
    expect(screen.getByRole('radio', { name: 'Lună' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Luna următoare' })).toBeInTheDocument();
  });

  it('An școlar înlocuiește selectorul de lună cu anul școlar, fără un al doilea titlu în conținut', async () => {
    await loadedSession();
    renderPage();
    await userEvent.click(screen.getByRole('radio', { name: 'An școlar' }));
    expect(screen.getByRole('combobox', { name: 'Anul școlar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Luna următoare' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    expect(localStorage.getItem('view.status')).toBe('year');
  });

  it('cele 4 carduri arată toată luna: de încasat, încasat cu bară, restanțe, fără taxă', async () => {
    await loadedSession();
    renderPage();
    expect(screen.getByText('De încasat').closest('div')).toHaveTextContent('2.500,00 lei');
    expect(screen.getByText('Încasat').closest('div')).toHaveTextContent('1.500,00 lei');
    expect(screen.getByRole('progressbar', { name: 'Încasat din de încasat' })).toHaveAttribute('aria-valuenow', '60');
    expect(screen.getByText('Restanțe').closest('div')).toHaveTextContent('1 copil');
    expect(screen.getByText('Fără taxă setată').closest('div')).toHaveTextContent('1');
  });

  it('„Completează →" duce la Taxe și grupe', async () => {
    await loadedSession();
    const { onNavigate } = renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Completează →' }));
    expect(onNavigate).toHaveBeenCalledWith('fees');
  });

  it('segmentul de statut restrânge tabelul, cardurile rămân', async () => {
    await loadedSession();
    renderPage();
    await userEvent.click(screen.getByRole('radio', { name: 'Achitat · 1' }));
    expect(screen.getByText('Elena Marin')).toBeInTheDocument();
    expect(screen.queryByText('Andrei Popescu')).not.toBeInTheDocument();
    expect(screen.getByText('De încasat').closest('div')).toHaveTextContent('2.500,00 lei');
  });

  it('Rest > 0 e roșu, Statut e badge, CTA depinde de statut', async () => {
    await loadedSession();
    const { onOpenChild } = renderPage();
    const overdueRow = screen.getByText('Andrei Popescu').closest('tr') as HTMLElement;
    expect(within(overdueRow).getByText('1.000,00 lei')).toHaveClass(/restDue/);
    const notifyButton = within(overdueRow).getByRole('button', { name: 'Notifică' });
    expect(notifyButton).toBeDisabled();
    expect(notifyButton).toHaveAttribute('title', 'Conectează sms.md în Notificări');
    const paidRow = screen.getByText('Elena Marin').closest('tr') as HTMLElement;
    await userEvent.click(within(paidRow).getByRole('button', { name: 'Vezi fișa' }));
    expect(onOpenChild).toHaveBeenCalledWith('c4');
  });

  it('bannerul de restanțieri apare cu „Notifică toți" dezactivat cât sms.md nu e conectat', async () => {
    await loadedSession();
    renderPage();
    expect(screen.getByText('1 restanțier')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifică toți' })).toBeDisabled();
  });

  it('modul An școlar arată cele trei carduri și „Notifică" dezactivat cât sms.md nu e conectat', async () => {
    await loadedSession();
    renderPage();
    await userEvent.click(screen.getByRole('radio', { name: 'An școlar' }));

    expect(screen.getByText('copii cu restanță')).toBeInTheDocument();
    expect(screen.getByText('rată de încasare')).toBeInTheDocument();
    expect(screen.getByText('plăți parțiale')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifică' })).toBeDisabled();
  });

  it('cu sms.md conectat, „Notifică” pe un rând deschide dialogul cu numele și telefonul copilului', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
        if (path === '/api/kindergarten') return jsonResponse({ name: 'Startica', idno: '' });
        if (path === '/api/sms-status') return jsonResponse(smsConfigured);
        if (path === '/api/sms-last-notified') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    const overdueRow = screen.getByText('Andrei Popescu').closest('tr') as HTMLElement;
    await user.click(within(overdueRow).getByRole('button', { name: 'Notifică' }));

    expect(screen.getAllByText('Andrei Popescu').length).toBeGreaterThan(1);
    // planSmsBatch normalizează telefonul la E.164 (chooseSmsRecipient/normalizeMoldovanPhone).
    expect(screen.getByText('+37369000000')).toBeInTheDocument();
    expect(screen.getByText(/Trimite SMS \(≈/)).toBeInTheDocument();
  });

  it('cu sms.md conectat, „Notifică toți” deschide dialogul de lot cu restanțierii', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
        if (path === '/api/kindergarten') return jsonResponse({ name: 'Startica', idno: '' });
        if (path === '/api/sms-status') return jsonResponse(smsConfigured);
        if (path === '/api/sms-last-notified') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Notifică toți' }));

    expect(screen.getByRole('dialog', { name: 'Trimite SMS către mai mulți destinatari' })).toBeInTheDocument();
    expect(screen.getByText(/Trimite 1 SMS \(≈/)).toBeInTheDocument();
  });

  it('cu sms.md conectat, „Notifică” din cardul An școlar deschide dialogul de lot', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
        if (path === '/api/kindergarten') return jsonResponse({ name: 'Startica', idno: '' });
        if (path === '/api/sms-status') return jsonResponse(smsConfigured);
        if (path === '/api/sms-last-notified') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('radio', { name: 'An școlar' }));
    await user.click(screen.getByRole('button', { name: 'Notifică' }));

    expect(screen.getByRole('dialog', { name: 'Trimite SMS către mai mulți destinatari' })).toBeInTheDocument();
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
        if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
        if (path === '/api/kindergarten') return jsonResponse({ name: 'Startica', idno: '' });
        if (path === '/api/sms-status') return jsonResponse(smsConfigured);
        if (path === '/api/sms-last-notified')
          // Data locală (nu toISOString, care e UTC): notifiedToday compară cu today() local — vezi useStatus.ts.
          return jsonResponse(
            notified
              ? { c1: { at: `${todayFn()}T12:00:00.000Z`, status: 'sent', month: '2026-09', templateName: 'Implicit' } }
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

    const overdueRow = screen.getByText('Andrei Popescu').closest('tr') as HTMLElement;
    await user.click(within(overdueRow).getByRole('button', { name: 'Notifică' }));
    await user.click(screen.getByText(/Trimite SMS \(≈/));

    expect(await screen.findByText('1 trimise · 0 eșuate · 0 netrimise')).toBeInTheDocument();
    await user.click(screen.getByText('Închide'));

    expect(await screen.findByText('SMS trimis către Maria Popescu')).toBeInTheDocument();
    expect(await screen.findByText('Notificat azi')).toBeInTheDocument();
  });

  it('căutarea din harta anului școlar restrânge la copilul căutat', async () => {
    await loadedSession();
    renderPage();
    await userEvent.click(screen.getByRole('radio', { name: 'An școlar' }));

    await userEvent.type(screen.getByRole('searchbox', { name: 'Caută copil' }), 'andrei');
    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument();
    expect(screen.queryByText('Elena Marin')).not.toBeInTheDocument();
  });

  it('schimbarea anului școlar din selector re-randează harta fără eroare', async () => {
    await loadedSession();
    renderPage();
    await userEvent.click(screen.getByRole('radio', { name: 'An școlar' }));

    const yearSelect = screen.getByRole('combobox', { name: 'Anul școlar' }) as HTMLSelectElement;
    const otherOption = within(yearSelect)
      .getAllByRole('option')
      .find(option => (option as HTMLOptionElement).value !== yearSelect.value) as HTMLOptionElement;
    await userEvent.selectOptions(yearSelect, otherOption);
    expect(yearSelect.value).toBe(otherOption.value);
  });
});
