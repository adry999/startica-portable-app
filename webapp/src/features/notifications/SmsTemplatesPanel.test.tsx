import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { SmsTemplatesPanel } from './SmsTemplatesPanel';

function renderPanel() {
  return render(
    <ToastProvider>
      <SmsTemplatesPanel />
    </ToastProvider>,
  );
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const defaultTemplate = {
  id: 't1',
  name: 'Reamintire restanță',
  body: 'Bună, {părinte}! Rest: {rest}.',
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

const smsStatus = {
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

function stubFetch(state?: unknown, rates?: Record<string, number>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
      if (path === '/api/state')
        return jsonResponse({
          state: state ?? { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] },
          revision: 1,
          updatedAt: '2026-09-27T10:00:00Z',
        });
      if (path === '/api/health') return jsonResponse({});
      if (path === '/api/sms-status') return jsonResponse(smsStatus);
      if (path === '/api/sms-templates')
        return jsonResponse({ templates: [defaultTemplate, customTemplate], usageCountById: { t1: 12, t2: 0 } });
      if (path === '/api/exchange-rates') return jsonResponse({ rates: rates ?? {}, sources: {} });
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

describe('SmsTemplatesPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('selectează implicit șablonul marcat Implicit și nu arată Șterge șablonul pentru el', async () => {
    stubFetch();
    renderPanel();

    expect(await screen.findByDisplayValue('Reamintire restanță')).toBeInTheDocument();
    expect(screen.queryByText('Șterge șablonul')).not.toBeInTheDocument();
  });

  // M10: previzualizarea trebuie să foloseasca `rates` din @shared/api/useExchangeRates — altfel un copil
  // cu taxă EUR plătit parțial în lei apare fără restanță reală (obligation().notify === false fără curs)
  // și panoul arată mereu datele de exemplu, chiar când există un restanțier real.
  it('previzualizarea folosește restanțierul real cu taxă EUR, convertit cu cursul din /api/exchange-rates', async () => {
    const state = {
      children: [
        {
          id: 'c1',
          name: 'Cristian Oprea',
          parent: 'Cristina Oprea',
          phone: '0722000000',
          contractDate: '2026-01-05',
          attendanceDate: '2026-01-05',
          status: 'Activ',
          statusHistory: [],
          feeHistory: [{ from: '2026-01', amount: 50, currency: 'EUR' }],
          groupId: null,
          archived: false,
        },
      ],
      // 380 lei la 19 lei/EUR = 20 EUR din 50 EUR taxă — rest 30 EUR, dacă panoul foloseste cursul.
      payments: [
        {
          id: 'p1',
          date: '2026-09-05',
          childId: 'c1',
          amount: 380,
          method: 'Cash',
          allocations: [{ month: '2026-09', amount: 380 }],
          archived: false,
        },
      ],
      expenses: [],
      groups: [],
      categories: [],
      visits: [],
    };
    stubFetch(state, { '2026-09-05': 19 });
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());
    renderPanel();

    await screen.findByDisplayValue('Reamintire restanță');
    expect(await screen.findByText(/Cristina Oprea/)).toBeInTheDocument();
  });

  it('arată „Folosit de N ori" pentru șablonul selectat', async () => {
    stubFetch();
    renderPanel();

    await screen.findByDisplayValue('Reamintire restanță');
    expect(screen.getByText('Folosit de 12 ori')).toBeInTheDocument();
  });

  it('un șablon care nu e implicit arată Șterge șablonul', async () => {
    stubFetch();
    renderPanel();
    const user = userEvent.setup();

    await screen.findByDisplayValue('Reamintire restanță');
    await user.click(screen.getByText('Personalizat'));

    expect(await screen.findByDisplayValue('Personalizat')).toBeInTheDocument();
    expect(screen.getByText('Șterge șablonul')).toBeInTheDocument();
  });

  it('„+ Șablon nou" pornește cu „Fără diacritice la trimitere" bifat', async () => {
    stubFetch();
    renderPanel();
    const user = userEvent.setup();

    await screen.findByDisplayValue('Reamintire restanță');
    await user.click(screen.getByText('+ Șablon nou'));

    expect(screen.getByLabelText('Nume')).toHaveValue('');
    expect(screen.getByLabelText('Fără diacritice la trimitere')).toBeChecked();
    expect(screen.queryByText('Șterge șablonul')).not.toBeInTheDocument();
  });

  it('salvarea trimite stripDiacritics și isDefault', async () => {
    const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
      if (path === '/api/state')
        return jsonResponse({
          state: { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] },
          revision: 1,
          updatedAt: '2026-09-27T10:00:00Z',
        });
      if (path === '/api/health') return jsonResponse({});
      if (path === '/api/sms-status') return jsonResponse(smsStatus);
      if (path === '/api/sms-templates') return jsonResponse({ templates: [defaultTemplate, customTemplate] });
      if (path === '/api/sms-template-save') {
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body.stripDiacritics).toBe(true);
        expect(body.isDefault).toBe(false);
        return jsonResponse({ ok: true, template: { ...customTemplate, id: 't3', name: 'Nou' } });
      }
      throw new Error(`neașteptat: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPanel();
    const user = userEvent.setup();

    await screen.findByDisplayValue('Reamintire restanță');
    await user.click(screen.getByText('+ Șablon nou'));
    await user.type(screen.getByLabelText('Nume'), 'Nou');
    await user.type(screen.getByLabelText('Text'), 'Salut {copil}');
    await user.click(screen.getByText('Salvează șablonul'));

    expect(fetchMock).toHaveBeenCalledWith('/api/sms-template-save', expect.anything());
  });

  it('un 400 la salvare arată eroarea, nu doar butonul reactivat fără mesaj (M7)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({
            state: { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] },
            revision: 1,
            updatedAt: '2026-09-27T10:00:00Z',
          });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/sms-status') return jsonResponse(smsStatus);
        if (path === '/api/sms-templates') return jsonResponse({ templates: [defaultTemplate, customTemplate] });
        if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
        if (path === '/api/sms-template-save') return { ok: false, status: 400, json: async () => ({ error: 'Numele șablonului e obligatoriu.' }) };
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderPanel();
    const user = userEvent.setup();

    await screen.findByDisplayValue('Reamintire restanță');
    await user.click(screen.getByText('Salvează șablonul'));

    expect(await screen.findByRole('status')).toHaveTextContent('Numele șablonului e obligatoriu.');
  });
});
