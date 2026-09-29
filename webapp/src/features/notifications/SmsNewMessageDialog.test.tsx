import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { SmsNewMessageDialog } from './SmsNewMessageDialog';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = {
  children: [
    {
      id: 'c1',
      name: 'Ion Popescu',
      status: 'Activ',
      groupId: null,
      parent: 'Maria Popescu',
      phone: '069123456',
      fee: 1500,
      feeHistory: [],
      statusHistory: [],
      dueDay: 10,
      archived: false,
    },
  ],
  groups: [],
  payments: [],
  expenses: [],
  categories: [],
  visits: [],
  charges: [],
  payerAliases: [],
  services: [],
};

const template = {
  id: 'TPL-1',
  name: 'Reamintire restanță',
  body: 'Bună ziua, {părinte}! Vă reamintim de {copil}.',
  stripDiacritics: true,
  isDefault: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

function stubFetch(
  overrides: { send?: (init?: RequestInit) => unknown; templateSave?: (init?: RequestInit) => unknown } = {},
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
      if (path === '/api/state')
        return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-27T00:00:00Z' });
      if (path === '/api/health') return jsonResponse({});
      if (path === '/api/personal/state')
        return jsonResponse({
          departments: [],
          roles: [],
          staff: [
            {
              id: 'STF-1',
              name: 'Elena Rusu',
              roleId: '',
              branchIds: [],
              phone: '069987654',
              since: '2020-01-01',
              notes: [],
            },
          ],
        });
      if (path === '/api/sms-templates') return jsonResponse({ templates: [template], usageCountById: {} });
      if (path === '/api/sms-send' && overrides.send) return jsonResponse(overrides.send(init));
      if (path === '/api/sms-template-save' && overrides.templateSave)
        return jsonResponse(overrides.templateSave(init));
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

async function renderDialog(onSent = vi.fn()) {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());

  render(
    <MemoryRouter>
      <SmsNewMessageDialog open unitCostLei={0.3} onClose={() => {}} onSent={onSent} />
    </MemoryRouter>,
  );
  return { onSent };
}

describe('SmsNewMessageDialog', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('„Din aplicație": alege un părinte, aplică șablonul implicit și trimite cu source manual, childId null', async () => {
    const sent: { body: any } = { body: null };
    stubFetch({
      send: init => {
        sent.body = JSON.parse(String(init?.body ?? '{}'));
        return {
          ok: true,
          results: [{ childId: null, outcome: 'sent', logId: 1, segments: 1, cost: '0.30', error: '' }],
          stopped: null,
          status: {},
        };
      },
    });
    const { onSent } = await renderDialog();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Alege persoana' }));
    await user.click(await screen.findByRole('option', { name: /Maria Popescu/ }));
    await user.click(await screen.findByRole('button', { name: 'Alege șablonul' }));
    await user.click(await screen.findByRole('option', { name: 'Reamintire restanță' }));

    expect(await screen.findByText(/Bună ziua, Maria Popescu! Vă reamintim de Ion Popescu\./)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Trimite SMS' }));

    expect(await screen.findByText('SMS trimis.')).toBeInTheDocument();
    expect(sent.body.source).toBe('manual');
    expect(sent.body.messages[0].childId).toBe(null);
    expect(sent.body.messages[0].recipientName).toBe('Maria Popescu');
    expect(sent.body.messages[0].phone).toBe('+37369123456');
    expect(onSent).toHaveBeenCalled();
  });

  it('„Alt număr" cu telefon invalid dezactivează Trimite SMS și arată eroarea inline', async () => {
    stubFetch();
    await renderDialog();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('radio', { name: 'Alt număr' }));
    await user.type(screen.getByRole('textbox', { name: 'Nume destinatar' }), 'Cineva');
    await user.type(screen.getByRole('textbox', { name: 'Telefon destinatar' }), '123');

    expect(await screen.findByText('Telefonul nu e un număr mobil moldovenesc valid.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trimite SMS' })).toBeDisabled();
  });

  it('„Text liber" cu „Salvează ca șablon nou" bifat salvează și șablonul după trimitere', async () => {
    const templateSaveCalls: unknown[] = [];
    stubFetch({
      send: () => ({
        ok: true,
        results: [{ childId: null, outcome: 'sent', logId: 2, segments: 1, cost: '0.30', error: '' }],
        stopped: null,
        status: {},
      }),
      templateSave: init => {
        templateSaveCalls.push(JSON.parse(String(init?.body ?? '{}')));
        return { ok: true, template: { ...template, id: 'TPL-2', name: 'Nou' } };
      },
    });
    await renderDialog();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('radio', { name: 'Alt număr' }));
    await user.type(screen.getByRole('textbox', { name: 'Nume destinatar' }), 'Cineva');
    await user.type(screen.getByRole('textbox', { name: 'Telefon destinatar' }), '069123456');
    await user.click(screen.getByRole('radio', { name: 'Text liber' }));
    await user.type(screen.getByRole('textbox', { name: 'Text mesaj' }), 'Salut!');
    await user.click(screen.getByRole('checkbox', { name: 'Salvează ca șablon nou' }));
    await user.type(screen.getByRole('textbox', { name: 'Nume șablon nou' }), 'Salut nou');

    await user.click(screen.getByRole('button', { name: 'Trimite SMS' }));

    expect(await screen.findByText('SMS trimis.')).toBeInTheDocument();
    expect(templateSaveCalls).toEqual([{ name: 'Salut nou', body: 'Salut!', stripDiacritics: true, isDefault: false }]);
  });
});
