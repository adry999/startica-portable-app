import { useState } from 'react';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider, TopbarActionsProvider, UndoToastProvider, useTopbarActionsSlot } from '@shared/ui';
import { ChildrenPage } from './ChildrenPage';

/** Randează slot-ul de antet ca Topbar-ul real — butoanele „Import CSV"/„+ Adaugă copil" ajung acolo, nu în pagină. */
function TopbarActionsSlot() {
  return <>{useTopbarActionsSlot()}</>;
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = {
  children: [
    {
      id: 'c1',
      name: 'Andrei Popescu',
      status: 'Activ',
      groupId: 'g1',
      parent: 'Maria Popescu',
      phone: '0722000001',
      fee: 1500,
      feeHistory: [{ from: '2020-01', amount: 1500 }],
      statusHistory: [],
      dueDay: 10,
      attendanceDate: '2022-09-01',
      birthDate: '2020-09-24',
      contractNumber: '7',
      archived: false,
    },
    {
      id: 'c2',
      name: 'Maria Ionescu',
      status: 'Activ',
      groupId: null,
      parent: 'Ioana Ionescu',
      phone: '0722000002',
      fee: 2000,
      feeHistory: [{ from: '2020-01', amount: 2000 }],
      statusHistory: [],
      dueDay: 28,
      attendanceDate: '2022-09-01',
      birthDate: '2019-05-10',
      archived: false,
    },
    {
      id: 'c3',
      name: 'Ionuț Marin',
      status: 'Activ',
      groupId: null,
      parent: 'Elena Marin',
      phone: '0722000003',
      fee: 1200,
      feeHistory: [{ from: '2020-01', amount: 1200 }],
      statusHistory: [],
      dueDay: 5,
      attendanceDate: '2022-09-01',
      birthDate: '2018-03-01',
      archived: true,
    },
  ],
  payments: [
    {
      id: 'p1',
      date: '2024-01-05',
      childId: 'c1',
      amount: 1500,
      method: 'Cash',
      allocations: [{ month: '2026-09', amount: 1500 }],
      archived: false,
    },
  ],
  expenses: [],
  groups: [{ id: 'g1', name: 'Fluturași', capacity: 15 }],
  categories: [],
  visits: [],
};

function ChildrenHarness() {
  const [childId, setChildId] = useState<string | null>(null);
  return (
    <ChildrenPage
      month="2026-09"
      onNavigate={() => {}}
      childId={childId}
      onOpenChild={setChildId}
      onCloseChild={() => setChildId(null)}
    />
  );
}

function renderPage(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ToastProvider>
        <UndoToastProvider>
          <TopbarActionsProvider>
            <TopbarActionsSlot />
            <ChildrenHarness />
          </TopbarActionsProvider>
        </UndoToastProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('ChildrenPage', () => {
  // 40b: fiecare /api/record ține minte auditId -> { recordId, before } (before=null la creare),
  // ca /api/undo să poată reface exact ce exista înainte — creare => șterge, update => restaurează
  // rândul vechi (grupă, arhivare, orice câmp), la fel ca restoreValueForUndo pe server.
  let nextAuditId = 9000;
  let auditLog = new Map<number, { recordId: string; before: unknown | null }>();

  beforeEach(() => {
    nextAuditId = 9000;
    auditLog = new Map();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/undo') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          const entry = auditLog.get(body.auditId);
          if (!entry) return { ok: false, status: 404, json: async () => ({ error: 'Nu există.' }) };
          const updated = {
            ...fixtureState,
            children:
              entry.before === null
                ? fixtureState.children.filter(c => c.id !== entry.recordId)
                : fixtureState.children.map(c =>
                    c.id === entry.recordId ? (entry.before as (typeof fixtureState.children)[number]) : c,
                  ),
          };
          return jsonResponse({ state: updated, revision: 3, updatedAt: '2026-09-23T10:06:00Z' });
        }
        if (path === '/api/record') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          const before =
            body.mode === 'create' ? null : (fixtureState.children.find(c => c.id === body.record.id) ?? null);
          const updated = {
            ...fixtureState,
            children:
              body.mode === 'create'
                ? [...fixtureState.children, body.record]
                : fixtureState.children.map(c => (c.id === body.record.id ? body.record : c)),
          };
          const auditId = nextAuditId++;
          auditLog.set(auditId, { recordId: body.record.id, before });
          return jsonResponse({ state: updated, revision: 2, updatedAt: '2026-09-23T10:05:00Z', auditId });
        }
        if (path === '/api/record-delete') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          const ids: string[] = body.ids ?? (body.id ? [body.id] : []);
          const updated = { ...fixtureState, children: fixtureState.children.filter(c => !ids.includes(c.id)) };
          return jsonResponse({ state: updated, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  it('arată scheletul de încărcare după 300 ms, înainte ca sesiunea să fie gata', () => {
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

  it('arată doar copiii activi implicit, cu statisticile din antet', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument();
    expect(screen.getByText('Maria Ionescu')).toBeInTheDocument();
    expect(screen.queryByText('Ionuț Marin')).not.toBeInTheDocument(); // arhivat, ascuns din filtrul implicit

    const activeStatCard = screen.getByText('Copii activi').closest('div')!.parentElement!;
    expect(within(activeStatCard).getByText('2')).toBeInTheDocument();
  });

  it('C-3: a treia opțiune de statut e „Toți”, fără numărul total', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    expect(screen.getByRole('radio', { name: 'Toți' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Toți ·/ })).not.toBeInTheDocument();
  });

  it('C-5: copilul fără grupă arată badge-ul „Fără grupă”', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const row = screen.getByText('Maria Ionescu').closest('tr')!;
    expect(within(row).getByText('Fără grupă')).toBeInTheDocument();
  });

  it('C-6/C-7: scadența arată „ziua N”, antetul plății arată luna curentă', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const row = screen.getByText('Andrei Popescu').closest('tr')!;
    expect(within(row).getByText('ziua 10')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Plată septembrie' })).toBeInTheDocument();
  });

  it('C-2: căutarea filtrează și după numele părintelui sau telefon, nu doar nume/contract', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const search = screen.getByLabelText('Caută copil');

    await userEvent.type(search, 'Ioana Ionescu');
    expect(screen.getByText('Maria Ionescu')).toBeInTheDocument();
    expect(screen.queryByText('Andrei Popescu')).not.toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, '0722000001');
    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument();
    expect(screen.queryByText('Maria Ionescu')).not.toBeInTheDocument();
  });

  it('C-10: schimbarea unui filtru resetează paginarea la pagina 1', async () => {
    const bigFixture = {
      ...fixtureState,
      // 30 ca să depășească pageSize implicit (25) — vezi Pagination/DataTable (F1).
      children: Array.from({ length: 30 }, (_, index) => ({
        id: `big-${index}`,
        name: `Copil ${String(index + 1).padStart(2, '0')}`,
        status: 'Activ',
        groupId: null,
        parent: 'Un părinte',
        phone: '0722000000',
        fee: 1000,
        feeHistory: [{ from: '2020-01', amount: 1000 }],
        statusHistory: [],
        dueDay: 10,
        attendanceDate: '2022-09-01',
        archived: false,
      })),
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: bigFixture, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    expect(screen.getByText('Copil 01')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('Copil 26')).toBeInTheDocument();
    expect(screen.queryByText('Copil 01')).not.toBeInTheDocument();

    // Filtrarea nu schimbă numărul de rânduri (toți 30 corespund în continuare „Copil”),
    // deci fără cheia derivată din filtre DataTable ar rămâne clamp-uit pe aceeași pagină.
    await userEvent.type(screen.getByLabelText('Caută copil'), 'Copil');
    expect(screen.getByText('Copil 01')).toBeInTheDocument();
    expect(screen.queryByText('Copil 26')).not.toBeInTheDocument();
  });

  it('§13.2: căutarea și grupa rămân la întoarcerea din fișă — stare în URL (?q=&grupa=)', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    // Simulează URL-ul la întoarcerea dintr-o fișă: filtrele au fost setate înainte de a naviga.
    renderPage('/copii?q=Ionescu&grupa=none');
    expect(screen.getByLabelText('Caută copil')).toHaveValue('Ionescu');
    expect(screen.getByText('Maria Ionescu')).toBeInTheDocument();
    expect(screen.queryByText('Andrei Popescu')).not.toBeInTheDocument();
  });

  it('§13.2: căutarea pe mai multe cuvinte nu e suprascrisă de resetarea paginii', async () => {
    // Regresie: setQuery + setPage separate (două navigări useSearchParams distincte) se
    // suprascriu reciproc — un singur apel useUrlParams trebuie să țină ambele câmpuri.
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const search = screen.getByLabelText('Caută copil');
    await userEvent.type(search, 'Ioana Ionescu');
    expect(search).toHaveValue('Ioana Ionescu');
    expect(screen.getByText('Maria Ionescu')).toBeInTheDocument();
    expect(screen.queryByText('Andrei Popescu')).not.toBeInTheDocument();
  });

  it('41a: filtrul „Date incomplete” arată doar copiii cu fișă incompletă', async () => {
    const mixedFixture = {
      ...fixtureState,
      children: [
        {
          id: 'complete-1',
          name: 'Complet Ionescu',
          status: 'Activ',
          groupId: 'g1',
          parent: 'Un părinte',
          phone: '0722000009',
          parent2: 'Alt părinte',
          phone2: '0722000008',
          idnp: '2001234567890',
          pickupPersons: [{ id: 'P1', name: 'Bunica' }],
          fee: 1000,
          feeHistory: [{ from: '2020-01', amount: 1000 }],
          statusHistory: [],
          dueDay: 10,
          attendanceDate: '2022-09-01',
          birthDate: '2020-01-01',
          archived: false,
        },
        {
          id: 'incomplete-1',
          name: 'Incomplet Marin',
          status: 'Activ',
          groupId: null,
          parent: 'Un părinte',
          phone: '0722000007',
          fee: 1000,
          feeHistory: [{ from: '2020-01', amount: 1000 }],
          statusHistory: [],
          dueDay: 10,
          attendanceDate: '2022-09-01',
          birthDate: '2020-01-01',
          archived: false,
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: mixedFixture, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    expect(screen.getByText('Complet Ionescu')).toBeInTheDocument();
    expect(screen.getByText('Incomplet Marin')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Date incomplete' }));
    expect(screen.queryByText('Complet Ionescu')).not.toBeInTheDocument();
    expect(screen.getByText('Incomplet Marin')).toBeInTheDocument();
  });

  it('45c: filtrul „Telefon invalid” arată doar copiii cu phoneInvalid/phone2Invalid', async () => {
    const phoneFixture = {
      ...fixtureState,
      children: [
        {
          id: 'ok-1',
          name: 'Telefon Bun',
          status: 'Activ',
          groupId: 'g1',
          parent: 'Un părinte',
          phone: '069000009',
          fee: 1000,
          feeHistory: [],
          statusHistory: [],
          dueDay: 10,
          archived: false,
        },
        {
          id: 'bad-1',
          name: 'Telefon Rău',
          status: 'Activ',
          groupId: 'g1',
          parent: 'Un părinte',
          phone: '12345',
          phoneInvalid: true,
          fee: 1000,
          feeHistory: [],
          statusHistory: [],
          dueDay: 10,
          archived: false,
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: phoneFixture, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    await userEvent.click(screen.getByRole('radio', { name: 'Telefon invalid' }));
    expect(screen.queryByText('Telefon Bun')).not.toBeInTheDocument();
    expect(screen.getByText('Telefon Rău')).toBeInTheDocument();
  });

  it('45c: ?filtru=telefon-invalid din Dashboard deschide Copiii cu filtrul „Telefon invalid” ales', async () => {
    const phoneFixture = {
      ...fixtureState,
      children: [
        { ...fixtureState.children[0], id: 'ok-1', name: 'Telefon Bun', phone: '069000009' },
        { ...fixtureState.children[0], id: 'bad-1', name: 'Telefon Rău', phone: '12345', phoneInvalid: true },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: phoneFixture, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage('/copii?filtru=telefon-invalid');

    expect(await screen.findByText('Telefon Rău')).toBeInTheDocument();
    expect(screen.queryByText('Telefon Bun')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Telefon invalid' })).toBeChecked();
  });

  it('deschide fișa copilului la click pe rând și revine la listă din breadcrumb', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    await userEvent.click(screen.getByText('Andrei Popescu'));

    const heading = screen.getByRole('heading', { name: 'Andrei Popescu' });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText(/Contract 7/)).toBeInTheDocument();
    // CF-10: rândul de sub nume începe cu „Născut”.
    const meta = heading.nextElementSibling;
    expect(meta?.textContent).toMatch(/^Născut 24\.09\.2020/);

    await userEvent.click(screen.getByRole('button', { name: 'Copii' }));
    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Andrei Popescu' })).not.toBeInTheDocument();
  });

  it('CF-1: fișa unui copil fără grupă arată hero-ul în tonul neutru (alb), nu portocaliu fix', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    await userEvent.click(screen.getByText('Maria Ionescu'));

    const heading = screen.getByRole('heading', { name: 'Maria Ionescu' });
    const hero = heading.closest(
      '[class*="_white_"], [class*="_orange_"], [class*="_mint_"], [class*="_yellow_"], [class*="_pink_"]',
    );
    expect(hero?.className).toMatch(/_white_/);
  });

  it('CF-3: cardul „Grupă și educator” arată N/capacitate și educatorul, „Schimbă” deschide alegerea grupei', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    await userEvent.click(screen.getByText('Andrei Popescu'));

    expect(screen.getByText(/1\/15 copii/)).toBeInTheDocument();
    expect(screen.getByText(/Educator —/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Schimbă' }));
    expect(screen.getByRole('button', { name: 'Schimbă grupa' })).toBeInTheDocument();
  });

  it('CF-6: acțiunea de tipărire din istoricul plăților e într-un RowMenu, cu eticheta „Tipărește confirmarea”', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    await userEvent.click(screen.getByText('Andrei Popescu'));

    const paymentRow = screen.getByText('Cash').closest('tr')!;
    await userEvent.click(within(paymentRow).getByLabelText('Mai multe acțiuni'));
    expect(within(paymentRow).getByRole('button', { name: 'Tipărește confirmarea' })).toBeInTheDocument();
  });

  it('40b: arhivează copilul selectat prin bara de selecție — UndoToast cu „Anulează · N” îl dezarhivează', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const row = screen.getByText('Maria Ionescu').closest('tr')!;
    await userEvent.click(within(row).getByRole('checkbox'));

    const selectionBar = screen.getByText('1 selectați').closest('div')!;
    await userEvent.click(within(selectionBar).getByRole('button', { name: 'Arhivează' }));

    expect(await screen.findByText('Copil arhivat')).toBeInTheDocument();
    expect(screen.getByText('Maria Ionescu')).toBeInTheDocument(); // detaliul din UndoToast
    expect(screen.queryByRole('row', { name: /Maria Ionescu/ })).not.toBeInTheDocument(); // dispare din listă (filtrul „Activi”)

    await userEvent.click(screen.getByRole('button', { name: /Anulează · \d+/ }));

    await screen.findByRole('row', { name: /Maria Ionescu/ }); // POST /api/undo a readus-o în listă
  });

  it('40b: mută un singur copil în grupă prin bara de selecție — UndoToast cu „Anulează · N” revine la grupa veche', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const row = screen.getByText('Andrei Popescu').closest('tr')!;
    expect(within(row).getByText('Fluturași')).toBeInTheDocument();
    await userEvent.click(within(row).getByRole('checkbox'));

    const selectionBar = screen.getByText('1 selectați').closest('div')!;
    await userEvent.click(within(selectionBar).getByLabelText('Mută în grupă'));
    await userEvent.click(screen.getByRole('button', { name: 'Fără grupă' }));

    expect(await screen.findByText('Copil mutat în grupă')).toBeInTheDocument();
    await waitFor(() => {
      const movedRow = screen.getByText('Andrei Popescu').closest('tr')!;
      expect(within(movedRow).getByText('Fără grupă')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /Anulează · \d+/ }));

    await waitFor(() => {
      const revertedRow = screen.getByText('Andrei Popescu').closest('tr')!;
      expect(within(revertedRow).getByText('Fluturași')).toBeInTheDocument();
    });
  });

  it('40b: mută mai mulți copii în grupă — Toast cu acțiune „Anulează”, nu UndoToast (N copii)', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const row1 = screen.getByText('Andrei Popescu').closest('tr')!;
    const row2 = screen.getByText('Maria Ionescu').closest('tr')!;
    await userEvent.click(within(row1).getByRole('checkbox'));
    await userEvent.click(within(row2).getByRole('checkbox'));

    const selectionBar = screen.getByText('2 selectați').closest('div')!;
    await userEvent.click(within(selectionBar).getByLabelText('Mută în grupă'));
    await userEvent.click(screen.getByRole('button', { name: 'Fluturași' }));

    expect(await screen.findByText('2 copii mutați în grupă.')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(screen.getByText('Maria Ionescu').closest('tr')!).getByText('Fluturași')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Anulează' }));

    await waitFor(() => {
      expect(within(screen.getByText('Maria Ionescu').closest('tr')!).getByText('Fără grupă')).toBeInTheDocument();
    });
  });

  it('adaugă un copil nou din formular — UndoToast cu „Anulează · N”', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '+ Adaugă copil' }));
    expect(screen.getByRole('dialog', { name: 'Copil nou' })).toBeInTheDocument();

    await user.type(screen.getAllByLabelText('Nume')[0], 'Radu');
    await user.type(screen.getByLabelText('Prenume'), 'Ionescu');
    await user.type(screen.getAllByLabelText('Nume')[1], 'Vasile Ionescu');
    await user.click(screen.getByRole('button', { name: 'Salvează copilul' }));

    // 40b: titlul din UndoToast (fără punct — Toast-ul separat l-ar fi avut), nu un Toast simplu.
    expect(await screen.findByText('Copil adăugat')).toBeInTheDocument();
    expect(screen.getAllByText('Radu Ionescu').length).toBeGreaterThan(0);
  });

  it('40b: „Anulează” din UndoToast, după un copil nou-creat, îl elimină din evidență', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '+ Adaugă copil' }));
    await user.type(screen.getAllByLabelText('Nume')[0], 'Radu');
    await user.type(screen.getByLabelText('Prenume'), 'Ionescu');
    await user.type(screen.getAllByLabelText('Nume')[1], 'Vasile Ionescu');
    await user.click(screen.getByRole('button', { name: 'Salvează copilul' }));

    expect(await screen.findByText('Copil adăugat')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Anulează · \d+/ }));

    await waitFor(() => expect(screen.queryByText('Radu Ionescu')).not.toBeInTheDocument());
  });

  it('?nou=1 în URL deschide direct formularul „Copil nou” (dashboard.attention.first)', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage('/copii?nou=1');

    expect(await screen.findByRole('dialog', { name: 'Copil nou' })).toBeInTheDocument();
  });

  it('editează fișa unui copil existent din meniul rândului', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    const row = screen.getByText('Andrei Popescu').closest('tr')!;
    await user.click(within(row).getByLabelText('Mai multe acțiuni'));
    await user.click(within(row).getByRole('button', { name: 'Editează' }));

    expect(screen.getByRole('dialog', { name: 'Editează copilul' })).toBeInTheDocument();
    // Fișă veche, fără firstName/lastName salvate: câmpurile pornesc goale (nu se
    // despică `name`-ul existent) — schimbarea numelui cere completarea ambelor.
    const lastNameInput = screen.getAllByLabelText('Nume')[0] as HTMLInputElement;
    const firstNameInput = screen.getByLabelText('Prenume') as HTMLInputElement;
    expect(lastNameInput.value).toBe('');
    expect(firstNameInput.value).toBe('');
    await user.type(lastNameInput, 'Andrei');
    await user.type(firstNameInput, 'Popescu-Ilie');
    await user.click(screen.getByRole('button', { name: 'Salvează copilul' }));

    expect(await screen.findByText('Fișă actualizată.')).toBeInTheDocument();
  });

  it('ștergerea definitivă rămâne dezactivată pentru un copil activ', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    const row = screen.getByText('Andrei Popescu').closest('tr')!;
    await user.click(within(row).getByLabelText('Mai multe acțiuni'));
    expect(within(row).getByRole('button', { name: 'Șterge definitiv' })).toBeDisabled();
  });

  it('șterge definitiv un copil arhivat, după confirmare', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('radio', { name: /Arhivați/ }));
    const row = screen.getByText('Ionuț Marin').closest('tr')!;
    await user.click(within(row).getByLabelText('Mai multe acțiuni'));
    await user.click(within(row).getByRole('button', { name: 'Șterge definitiv' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Ștergere definitivă' });
    await user.type(within(dialog).getByLabelText('Scrie ȘTERGE pentru confirmare'), 'ȘTERGE');
    await user.click(within(dialog).getByRole('button', { name: 'Șterge definitiv' }));

    expect(await screen.findByText('Fișă ștearsă definitiv.')).toBeInTheDocument();
  });

  it('B2: „Șterge definitiv” din bara de selecție nu apare pentru rânduri active, dar apare pentru cele arhivate', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    const activeRow = screen.getByText('Maria Ionescu').closest('tr')!;
    await user.click(within(activeRow).getByRole('checkbox'));
    let selectionBar = screen.getByText('1 selectați').closest('div')!;
    expect(within(selectionBar).queryByRole('button', { name: 'Șterge definitiv' })).not.toBeInTheDocument();
    await user.click(within(selectionBar).getByRole('button', { name: 'Anulează' }));

    await user.click(screen.getByRole('radio', { name: /Arhivați/ }));
    const archivedRow = screen.getByText('Ionuț Marin').closest('tr')!;
    await user.click(within(archivedRow).getByRole('checkbox'));
    selectionBar = screen.getByText('1 selectați').closest('div')!;
    await user.click(within(selectionBar).getByRole('button', { name: 'Șterge definitiv' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Ștergi definitiv 1 copil?' });
    await user.type(within(dialog).getByLabelText('Scrie ȘTERGE pentru confirmare'), 'ȘTERGE');
    await user.click(within(dialog).getByRole('button', { name: 'Șterge 1 copil' }));

    expect(await screen.findByText('1 copil șters definitiv.')).toBeInTheDocument();
    expect(screen.queryByText('Ionuț Marin')).not.toBeInTheDocument();
  });
});
