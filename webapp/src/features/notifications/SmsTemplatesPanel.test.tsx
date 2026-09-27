import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmsTemplatesPanel } from './SmsTemplatesPanel';

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

function stubFetch() {
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
      if (path === '/api/sms-templates')
        return jsonResponse({ templates: [defaultTemplate, customTemplate], usageCountById: { t1: 12, t2: 0 } });
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
    render(<SmsTemplatesPanel />);

    expect(await screen.findByDisplayValue('Reamintire restanță')).toBeInTheDocument();
    expect(screen.queryByText('Șterge șablonul')).not.toBeInTheDocument();
  });

  it('arată „Folosit de N ori" pentru șablonul selectat', async () => {
    stubFetch();
    render(<SmsTemplatesPanel />);

    await screen.findByDisplayValue('Reamintire restanță');
    expect(screen.getByText('Folosit de 12 ori')).toBeInTheDocument();
  });

  it('un șablon care nu e implicit arată Șterge șablonul', async () => {
    stubFetch();
    render(<SmsTemplatesPanel />);
    const user = userEvent.setup();

    await screen.findByDisplayValue('Reamintire restanță');
    await user.click(screen.getByText('Personalizat'));

    expect(await screen.findByDisplayValue('Personalizat')).toBeInTheDocument();
    expect(screen.getByText('Șterge șablonul')).toBeInTheDocument();
  });

  it('„+ Șablon nou" pornește cu „Fără diacritice la trimitere" bifat', async () => {
    stubFetch();
    render(<SmsTemplatesPanel />);
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

    render(<SmsTemplatesPanel />);
    const user = userEvent.setup();

    await screen.findByDisplayValue('Reamintire restanță');
    await user.click(screen.getByText('+ Șablon nou'));
    await user.type(screen.getByLabelText('Nume'), 'Nou');
    await user.type(screen.getByLabelText('Text'), 'Salut {copil}');
    await user.click(screen.getByText('Salvează șablonul'));

    expect(fetchMock).toHaveBeenCalledWith('/api/sms-template-save', expect.anything());
  });
});
