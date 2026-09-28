import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider, TopbarActionsProvider, useTopbarActionsSlot } from '@shared/ui';
import { AttendancePage } from './AttendancePage';

function TopbarActionsSlot() {
  return <>{useTopbarActionsSlot()}</>;
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

// Data trebuie să fie „azi" — DayStepper și useAttendanceDay pornesc din today().
const TODAY = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();
const FUTURE_DAY = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

const fixtureState = {
  children: [
    { id: 'c1', name: 'Ana Popescu', parent: '', phone: '', groupId: 'g1', status: 'Activ' },
    { id: 'c2', name: 'Bogdan Rusu', parent: '', phone: '', groupId: 'g1', status: 'Activ' },
    { id: 'c3', name: 'Cristina Ionescu', parent: '', phone: '', groupId: null, status: 'Activ' },
    { id: 'c4', name: 'Arhivat Cineva', parent: '', phone: '', groupId: 'g1', status: 'Activ', archived: true },
    {
      id: 'c5',
      name: 'Viitor Copil',
      parent: '',
      phone: '',
      groupId: 'g1',
      status: 'Activ',
      attendanceDate: FUTURE_DAY,
    },
  ],
  payments: [],
  expenses: [],
  groups: [{ id: 'g1', name: 'Fluturași', capacity: 10 }],
  categories: [],
  visits: [],
};

type PostedBatch = { changes: { childId: string; date: string; status: string | null; reason?: string }[] };

function stubFetch(posted: PostedBatch[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
      if (path === '/api/state')
        return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
      if (path === '/api/health') return jsonResponse({});
      if (path === `/api/attendance?date=${TODAY}`) return jsonResponse({ entries: [] });
      if (path.startsWith('/api/attendance?month=')) return jsonResponse({ entries: [] });
      if (path === '/api/attendance' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body ?? '{}')) as PostedBatch;
        posted.push(body);
        return jsonResponse({
          ok: true,
          saved: body.changes
            .filter(change => change.status !== null)
            .map(change => ({ ...change, reason: change.reason ?? '', updatedAt: '2026-09-27T09:00:00Z' })),
          removed: body.changes
            .filter(change => change.status === null)
            .map(({ childId, date }) => ({ childId, date })),
        });
      }
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

/** Trimite bara debounce-ului de 400ms cu timere reale (mai simplu de sincronizat cu userEvent decât fake timers). */
async function waitForDebounce() {
  await act(() => new Promise(resolve => setTimeout(resolve, 450)));
}

async function renderPage() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
  render(
    <ToastProvider>
      <TopbarActionsProvider>
        <TopbarActionsSlot />
        <AttendancePage month="2026-09" />
      </TopbarActionsProvider>
    </ToastProvider>,
  );
  await screen.findByText('Prezenți');
}

describe('AttendancePage · Ziua', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear(); // usePersistedState scrie mod-ul (Ziua/Luna) — fără curățare, testele următoare pornesc în Luna.
  });

  it('un clic pe placă trece Prezent → Absent → Motivat → nemarcat și trimite POST-ul după 400 ms', async () => {
    const posted: PostedBatch[] = [];
    stubFetch(posted);
    await renderPage();

    const user = userEvent.setup();
    const tile = screen.getByRole('button', { name: /Ana Popescu:/ });
    await user.click(tile); // prezent
    await user.click(tile); // absent
    await user.click(tile); // motivat -> deschide popover, se anulează la clic în afară
    await user.keyboard('{Escape}');
    await user.click(tile); // nemarcat

    expect(screen.getByRole('button', { name: 'Ana Popescu: Nemarcat' })).toBeInTheDocument();
    expect(posted).toHaveLength(0);

    await waitForDebounce();

    expect(posted).toHaveLength(1);
    expect(posted[0].changes).toEqual([{ childId: 'c1', date: TODAY, status: null }]);
  });

  it('„Motivat” deschide popover-ul, iar motivul ales pleacă în același POST', async () => {
    const posted: PostedBatch[] = [];
    stubFetch(posted);
    await renderPage();

    // M14: cu timere reale + userEvent.type (delay real între taste), debounce-ul de 400 ms pornit
    // de al treilea clic (starea „motivat”, cu reason='') putea expira cât timp se tasta motivul
    // (mai ales în suita completă, mai lentă) — flush()-ul intermediar trimitea un prim POST cu
    // reason='', înainte ca „Salvează” din popover să apuce să-l completeze. `fireEvent` scrie
    // motivul sincron (fără scurgere de timp real între taste), deci debounce-ul pornit de clicul
    // „motivat” nu mai poate expira înainte de „Salvează” — nu mai există cursa, fără timere false
    // (care blochează userEvent/act pe alte hook-uri din pagină, vezi TimesheetView.test.tsx).
    const tile = screen.getByRole('button', { name: /Ana Popescu:/ });
    fireEvent.click(tile); // prezent
    fireEvent.click(tile); // absent
    fireEvent.click(tile); // motivat -> popover, pornește debounce-ul pentru status='excused', reason=''

    const dialog = screen.getByRole('dialog', { name: /Ana Popescu/ });
    fireEvent.change(within(dialog).getByPlaceholderText('Motivul absenței…'), { target: { value: 'Boală' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvează' }));

    await waitForDebounce();

    expect(posted).toHaveLength(1);
    expect(posted[0].changes).toEqual([{ childId: 'c1', date: TODAY, status: 'excused', reason: 'Boală' }]);
  });

  it('„Nemarcații (N) → prezenți” trimite doar copiii fără marcaj', async () => {
    const posted: PostedBatch[] = [];
    stubFetch(posted);
    await renderPage();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Bogdan Rusu:/ })); // marcat prezent, nu mai e „nemarcat”

    await waitForDebounce();
    expect(posted).toHaveLength(1);
    expect(posted[0].changes[0]).toEqual({ childId: 'c2', date: TODAY, status: 'present' });
    posted.length = 0;

    expect(screen.getByRole('button', { name: 'Bogdan Rusu: Prezent' })).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Nemarcații (2) → prezenți' });
    expect(button).not.toBeDisabled();
    await user.click(button);
    await waitForDebounce();

    expect(posted).toHaveLength(1);
    const changedChildIds = posted[0].changes.map(change => change.childId).sort();
    expect(changedChildIds).toEqual(['c1', 'c3']);
  });

  it('„Nemarcații (N) → prezenți” pe secțiune nu suprascrie Absent/Motivat', async () => {
    const posted: PostedBatch[] = [];
    stubFetch(posted);
    await renderPage();

    const user = userEvent.setup();
    const anaTile = screen.getByRole('button', { name: /Ana Popescu:/ });
    await user.click(anaTile); // prezent
    await user.click(anaTile); // absent
    await waitForDebounce();
    posted.length = 0;

    // Fluturași randează prima secțiune (Fără grupă e mereu ultima) — primul buton e al ei.
    // Ana e deja Absent, Bogdan e nemarcat -> secțiunea are 1 nemarcat.
    const sectionButton = screen.getAllByRole('button', { name: 'Nemarcații (1) → prezenți' })[0];
    await user.click(sectionButton);
    await waitForDebounce();

    expect(posted).toHaveLength(1);
    expect(posted[0].changes).toEqual([{ childId: 'c2', date: TODAY, status: 'present' }]);
    expect(screen.getByRole('button', { name: /Ana Popescu: Absent/ })).toBeInTheDocument();
  });

  it('„Nemarcații (0) → prezenți” pe secțiune e dezactivat când nu mai e nimeni nemarcat', async () => {
    const posted: PostedBatch[] = [];
    stubFetch(posted);
    await renderPage();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Ana Popescu:/ }));
    await user.click(screen.getByRole('button', { name: /Bogdan Rusu:/ }));
    await waitForDebounce();

    const sectionButton = screen.getAllByRole('button', { name: 'Nemarcații (0) → prezenți' })[0];
    expect(sectionButton).toBeDisabled();
  });

  it('cardurile numără pe toate grupele când filtrul e pe o grupă', async () => {
    const posted: PostedBatch[] = [];
    stubFetch(posted);
    await renderPage();

    const unmarkedValue = () => screen.getByText('Nemarcați').nextSibling as HTMLElement;
    expect(unmarkedValue().textContent).toBe('3');

    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'Fluturași' }));

    expect(screen.queryByText('Cristina Ionescu')).not.toBeInTheDocument();
    expect(unmarkedValue().textContent).toBe('3');
  });

  it('cifra Absenți e roz-raspberry și Motivați e galben, restul rămân slate', async () => {
    const posted: PostedBatch[] = [];
    stubFetch(posted);
    await renderPage();

    const user = userEvent.setup();
    const absentTile = screen.getByRole('button', { name: /Ana Popescu:/ });
    await user.click(absentTile); // prezent
    await user.click(absentTile); // absent

    const excusedTile = screen.getByRole('button', { name: /Bogdan Rusu:/ });
    await user.click(excusedTile); // prezent
    await user.click(excusedTile); // absent
    await user.click(excusedTile); // motivat -> popover
    await user.keyboard('{Escape}');

    const absentValue = screen.getByText('Absenți').nextSibling as HTMLElement;
    const excusedValue = screen.getByText('Motivați').nextSibling as HTMLElement;
    const presentValue = screen.getByText('Prezenți').nextSibling as HTMLElement;
    const unmarkedValue = screen.getByText('Nemarcați').nextSibling as HTMLElement;

    expect(absentValue.textContent).toBe('1');
    expect(absentValue.className).toMatch(/cardValueAbsent/);
    expect(excusedValue.textContent).toBe('1');
    expect(excusedValue.className).toMatch(/cardValueExcused/);
    expect(presentValue.className).not.toMatch(/cardValueAbsent|cardValueExcused/);
    expect(unmarkedValue.className).not.toMatch(/cardValueAbsent|cardValueExcused/);
  });

  it('copiii arhivați sau înscriși după zi nu apar', async () => {
    stubFetch([]);
    await renderPage();

    expect(screen.queryByText('Arhivat Cineva')).not.toBeInTheDocument();
    expect(screen.queryByText('Viitor Copil')).not.toBeInTheDocument();
  });

  it('ziua următoare e blocată la azi', async () => {
    stubFetch([]);
    await renderPage();

    expect(screen.getByRole('button', { name: 'Ziua următoare' })).toBeDisabled();
  });

  it('modul Luna arată grila grupei și un clic pe celulă schimbă starea acelei zile', async () => {
    const posted: PostedBatch[] = [];
    stubFetch(posted);
    await renderPage();

    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'Luna' }));

    await screen.findByText('Ana Popescu');
    expect(screen.queryByText('Arhivat Cineva')).not.toBeInTheDocument();

    const firstCell = screen.getAllByRole('button', { name: /Ana Popescu: 2026-09/ })[0];
    await user.click(firstCell);
    await waitForDebounce();

    expect(posted).toHaveLength(1);
    expect(posted[0].changes[0]).toMatchObject({ childId: 'c1', status: 'present' });
  });

  it('„Tipărește” și „Exportă” stau în antet, lângă MonthStepper, nu în bara de filtre', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    stubFetch([]);
    await renderPage();

    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'Luna' }));
    await screen.findByText('Ana Popescu');

    const printButton = screen.getByRole('button', { name: 'Tipărește luna' });
    const exportButton = screen.getByRole('button', { name: 'Exportă' });
    const filterBar = screen.getByRole('toolbar');
    expect(filterBar).not.toContainElement(printButton);
    expect(filterBar).not.toContainElement(exportButton);

    await user.click(printButton);
    expect(printSpy).toHaveBeenCalled();

    printSpy.mockRestore();
  });

  it('indicatorul de salvare arată „Salvat · ora” după un marcaj reușit', async () => {
    const posted: PostedBatch[] = [];
    stubFetch(posted);
    await renderPage();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Ana Popescu:/ }));
    await waitForDebounce();

    expect(screen.getByText(/^Salvat · \d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it('un marcaj eșuat arată „Nesalvat” + „Încearcă din nou”, care retrimite lotul', async () => {
    let postCalls = 0;
    const posted: PostedBatch[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === `/api/attendance?date=${TODAY}`) return jsonResponse({ entries: [] });
        if (path === '/api/attendance' && init?.method === 'POST') {
          postCalls++;
          const body = JSON.parse(String(init.body ?? '{}')) as PostedBatch;
          posted.push(body);
          if (postCalls === 1) return jsonResponse({ error: 'Cerere respinsă.' }, false, 400);
          return jsonResponse({
            ok: true,
            saved: body.changes.map(change => ({ ...change, reason: change.reason ?? '', updatedAt: '2026-09-27T09:00:00Z' })),
            removed: [],
          });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    await renderPage();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Ana Popescu:/ }));
    await waitForDebounce();

    expect(screen.getByText('Nesalvat · 1 modificare')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: 'Încearcă din nou' });

    await user.click(retryButton);
    await waitForDebounce();

    expect(postCalls).toBe(2);
    expect(screen.getByText(/^Salvat · \d{2}:\d{2}$/)).toBeInTheDocument();
  });
});
