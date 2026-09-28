import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TopbarActionsProvider, useTopbarActionsSlot } from '@shared/ui';
import { AuditLogPage } from './AuditLogPage';

/** Randează slot-ul de antet ca Topbar-ul real — căutarea și filtrul ajung acolo, nu în pagină. */
function TopbarActionsSlot() {
  return <>{useTopbarActionsSlot()}</>;
}

function renderPage() {
  return render(
    <TopbarActionsProvider>
      <TopbarActionsSlot />
      <AuditLogPage />
    </TopbarActionsProvider>,
  );
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const now = new Date();
const todayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0).toISOString();

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

describe('AuditLogPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arată o încărcare, apoi intrările grupate pe zi, cu eticheta acțiunii și diferența', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/audit') return jsonResponse(page1);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderPage();

    expect(await screen.findByText('c1')).toBeInTheDocument();
    expect(screen.getByText('Modificat')).toBeInTheDocument();
    expect(screen.getByText('Asociat')).toBeInTheDocument();
    expect(screen.getByText(/Azi ·/)).toBeInTheDocument();
  });

  it('"Mai multe" încarcă pagina următoare fără să șteargă rândurile deja afișate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/audit') return jsonResponse(page1);
        if (path === '/api/audit?beforeEntryId=1') return jsonResponse(page2);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Modificat');
    await user.click(screen.getByText('Mai multe'));

    await waitFor(() => expect(screen.getByText('Creat')).toBeInTheDocument());
  });

  it('comutatorul „Copii" ascunde rândurile altui tip de înregistrare', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/audit') return jsonResponse(page1);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Modificat');
    await user.click(screen.getByRole('radio', { name: 'Copii' }));

    expect(screen.getByText('Modificat')).toBeInTheDocument();
    expect(screen.queryByText('Asociat')).not.toBeInTheDocument();
  });

  it('căutarea filtrează după identificatorul înregistrării', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/audit') return jsonResponse(page1);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Modificat');
    await user.type(screen.getByLabelText('Caută în istoric'), 'p1');

    await waitFor(() => expect(screen.queryByText('Modificat')).not.toBeInTheDocument());
    expect(screen.getByText('Asociat')).toBeInTheDocument();
  });
});
