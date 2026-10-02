import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { reloadPersonal } from '@shared/personal/usePersonal';
import { TopbarActionsProvider, useTopbarActionsSlot } from '@shared/ui';
import { AuditLogPage } from './AuditLogPage';

/** Randează slot-ul de antet ca Topbar-ul real — căutarea și filtrul ajung acolo, nu în pagină. */
function TopbarActionsSlot() {
  return <>{useTopbarActionsSlot()}</>;
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const now = new Date();
const todayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0).toISOString();

const fixtureState = {
  children: [{ id: 'c1', name: 'Ana Popescu', status: 'Activ', groupId: null, archived: false }],
  payments: [{ id: 'p1', date: '2026-09-10', childId: 'c1', amount: 1500, method: 'Cash', archived: false }],
  expenses: [],
  groups: [{ id: 'G1', name: 'Mars', capacity: 10 }],
  categories: [],
  visits: [],
};

const fixturePersonalState = {
  departments: [],
  roles: [],
  staff: [{ id: 'STF-1', name: 'Doina Cebotari', roleId: '', branchIds: [], phone: '', since: '', notes: [] }],
  settings: { annualLeaveDays: 28, deductOnlyUnexcused: true },
};

const page1 = {
  entries: [
    {
      id: 2,
      occurredAt: todayIso,
      action: 'modificare',
      recordType: 'children',
      recordId: 'c1',
      before: { fee: 1000 },
      after: { fee: 1500 },
    },
    {
      id: 3,
      occurredAt: todayIso,
      action: 'asociere achitare',
      recordType: 'payments',
      recordId: 'p1',
      before: null,
      after: { childId: 'c1' },
    },
  ],
  nextBeforeEntryId: 1,
};

const page2 = {
  entries: [
    {
      id: 1,
      occurredAt: todayIso,
      action: 'adăugare',
      recordType: 'children',
      recordId: 'c1',
      before: null,
      after: { fee: 1000 },
    },
  ],
  nextBeforeEntryId: null,
};

function stubFetch(auditHandler: (path: string) => unknown = path => (path === '/api/audit' ? page1 : undefined)) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
      if (path === '/api/state') return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '' });
      if (path === '/api/health') return jsonResponse({});
      if (path === '/api/personal/state') return jsonResponse(fixturePersonalState);
      const body = auditHandler(path);
      if (body !== undefined) return jsonResponse(body);
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

function renderPage(initialEntries: string[] = ['/istoric']) {
  return render(
    <TopbarActionsProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <TopbarActionsSlot />
        <AuditLogPage />
      </MemoryRouter>
    </TopbarActionsProvider>,
  );
}

describe('AuditLogPage', () => {
  beforeEach(() => stubFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('arată o încărcare, apoi intrările grupate pe zi, cu eticheta acțiunii și diferența', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    renderPage();

    expect(await screen.findByText('c1')).toBeInTheDocument();
    expect(screen.getByText('Modificat')).toBeInTheDocument();
    expect(screen.getByText('Asociat')).toBeInTheDocument();
    expect(screen.getByText(/Azi ·/)).toBeInTheDocument();
  });

  it('"Mai multe" încarcă pagina următoare fără să șteargă rândurile deja afișate', async () => {
    stubFetch(path => {
      if (path === '/api/audit') return page1;
      if (path === '/api/audit?beforeEntryId=1') return page2;
      return undefined;
    });
    await loadedSession();
    await act(() => reloadPersonal());

    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Modificat');
    await user.click(screen.getByText('Mai multe'));

    await waitFor(() => expect(screen.getByText('Creat')).toBeInTheDocument());
  });

  it('PROMPT-9 §6: filtrul „Modul" (Copii) ascunde rândurile altui tip de înregistrare', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Modificat');
    await user.click(screen.getByRole('button', { name: 'Modul' }));
    await user.click(screen.getByRole('checkbox', { name: 'Copii' }));

    expect(screen.getByText('Modificat')).toBeInTheDocument();
    expect(screen.queryByText('Asociat')).not.toBeInTheDocument();
  });

  it('PROMPT-9 §6: filtrul „Perioadă" (interval) ascunde rândurile din afara intervalului', async () => {
    stubFetch(path =>
      path === '/api/audit'
        ? {
            entries: [page1.entries[0], { ...page1.entries[1], id: 9, occurredAt: '2020-01-05T10:00:00.000Z' }],
            nextBeforeEntryId: null,
          }
        : undefined,
    );
    await loadedSession();
    await act(() => reloadPersonal());

    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Modificat');
    expect(screen.getByText('Asociat')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Perioadă/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Ultimele 30 de zile' }));

    expect(screen.getByText('Modificat')).toBeInTheDocument();
    expect(screen.queryByText('Asociat')).not.toBeInTheDocument();
  });

  it('PROMPT-9 §6: filtrul „Calculator" arată o singură opțiune locală și nu elimină rânduri', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Modificat');
    await user.click(screen.getByRole('button', { name: 'Calculator' }));
    expect(screen.getByRole('checkbox', { name: 'Acest calculator' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /·/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Acest calculator' }));

    expect(screen.getByText('Modificat')).toBeInTheDocument();
    expect(screen.getByText('Asociat')).toBeInTheDocument();
  });

  it('căutarea filtrează după identificatorul înregistrării', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Modificat');
    await user.type(screen.getByLabelText('Caută în istoric'), 'p1');

    await waitFor(() => expect(screen.queryByText('Modificat')).not.toBeInTheDocument());
    expect(screen.getByText('Asociat')).toBeInTheDocument();
  });

  it('45a: SearchSelect oferă copii, angajați, grupe și achitări (după sumă)', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Alege o înregistrare' }));
    expect(screen.getByRole('option', { name: 'Copii · Ana Popescu' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Angajați · Doina Cebotari' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Grupe · Mars' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Achitări · 1.500,00 lei · Ana Popescu/ })).toBeInTheDocument();
  });

  it('45a: alegerea unui copil cere /api/audit/scope cu copilul și achitările lui', async () => {
    const fetchSpy = vi.fn((path: string) => {
      if (path.startsWith('/api/audit/scope')) return page1;
      if (path === '/api/audit') return { entries: [], nextBeforeEntryId: null };
      return undefined;
    });
    stubFetch(fetchSpy);
    await loadedSession();
    await act(() => reloadPersonal());

    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Alege o înregistrare' }));
    await user.click(screen.getByRole('option', { name: 'Copii · Ana Popescu' }));

    await screen.findByText('Modificat');
    const scopeCall = fetchSpy.mock.calls
      .map(call => call[0] as string)
      .find(path => path.startsWith('/api/audit/scope'));
    expect(scopeCall).toBeDefined();
    const scope = JSON.parse(decodeURIComponent(scopeCall!.split('scope=')[1]));
    expect(scope).toEqual(
      expect.arrayContaining([
        { recordType: 'children', recordId: 'c1' },
        { recordType: 'payments', recordId: 'p1' },
      ]),
    );
    expect(screen.getByRole('button', { name: 'Tot istoricul' })).toBeInTheDocument();
  });

  it('45a/45b: recordType+recordId din URL preselectează copilul („Tot istoricul” din fișă)', async () => {
    stubFetch(path => {
      if (path.startsWith('/api/audit/scope')) return page1;
      return undefined;
    });
    await loadedSession();
    await act(() => reloadPersonal());

    renderPage(['/istoric?recordType=children&recordId=c1']);

    await screen.findByText('Modificat');
    expect(screen.getByRole('button', { name: 'Tot istoricul' })).toBeInTheDocument();
  });
});
