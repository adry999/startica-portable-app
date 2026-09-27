import { act, render, renderHook, screen, within } from '@testing-library/react';
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

    const user = userEvent.setup();
    const tile = screen.getByRole('button', { name: /Ana Popescu:/ });
    await user.click(tile); // prezent
    await user.click(tile); // absent
    await user.click(tile); // motivat -> popover

    const dialog = screen.getByRole('dialog', { name: /Ana Popescu/ });
    await user.type(within(dialog).getByPlaceholderText('Motivul absenței…'), 'Boală');
    await user.click(within(dialog).getByRole('button', { name: 'Salvează' }));

    await waitForDebounce();

    expect(posted).toHaveLength(1);
    expect(posted[0].changes).toEqual([{ childId: 'c1', date: TODAY, status: 'excused', reason: 'Boală' }]);
  });

  it('„Toți nemarcații → prezenți” trimite doar copiii fără marcaj', async () => {
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
    const button = screen.getByRole('button', { name: 'Toți nemarcații → prezenți' });
    expect(button).not.toBeDisabled();
    await user.click(button);
    await waitForDebounce();

    expect(posted).toHaveLength(1);
    const changedChildIds = posted[0].changes.map(change => change.childId).sort();
    expect(changedChildIds).toEqual(['c1', 'c3']);
  });

  it('„Toată grupa prezentă” marchează toți copiii grupei', async () => {
    const posted: PostedBatch[] = [];
    stubFetch(posted);
    await renderPage();

    const user = userEvent.setup();
    // Fluturași randează prima secțiune (Fără grupă e mereu ultima) — primul buton e al ei.
    await user.click(screen.getAllByRole('button', { name: 'Toată grupa prezentă' })[0]);

    await waitForDebounce();

    expect(posted).toHaveLength(1);
    const changedChildIds = posted[0].changes.map(change => change.childId).sort();
    expect(changedChildIds).toEqual(['c1', 'c2']);
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
});
