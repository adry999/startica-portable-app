import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider, TopbarActionsProvider, useTopbarActionsSlot } from '@shared/ui';
import { readDirtyForms } from '@shared/state/dirty-forms';
import { reloadPersonal } from '@shared/personal/usePersonal';
import { GroupsPage } from './GroupsPage';

/** Randează slot-ul de antet ca Topbar-ul real — comutatorul Tablă/Carduri și „+ Grupă nouă" ajung acolo. */
function TopbarActionsSlot() {
  return <>{useTopbarActionsSlot()}</>;
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = {
  children: [
    { id: 'c1', name: 'Andrei Popescu', groupId: 'g1', birthDate: '2020-09-24', archived: false },
    { id: 'c2', name: 'Maria Ionescu', groupId: 'g1', birthDate: '2019-01-15', archived: false },
    { id: 'c4', name: 'Vlad Marin', groupId: null, birthDate: '2020-01-01', archived: false },
  ],
  payments: [],
  expenses: [],
  groups: [
    { id: 'g1', name: 'Fluturași', capacity: 2, educator: 'Ioana' },
    { id: 'g2', name: 'Ursuleți', capacity: 5, educator: 'Maria' },
  ],
  categories: [],
  visits: [],
};

const fixturePersonalState = {
  departments: [{ id: 'DEP-1', name: 'Educatori', order: 1 }],
  roles: [{ id: 'ROL-1', name: 'Educator', departmentId: 'DEP-1', order: 1 }],
  staff: [
    {
      id: 'STF-1',
      name: 'Ana Popescu',
      roleId: 'ROL-1',
      branchIds: ['bu'],
      phone: '',
      since: '2020-01-01',
      archivedAt: null,
      notes: [],
    },
  ],
  settings: { annualLeaveDays: 28, deductOnlyUnexcused: true },
};

function renderPage(onOpenGroupStickers?: (groupId: string) => void) {
  return render(
    <ToastProvider>
      <TopbarActionsProvider>
        <div data-testid="topbar-slot">
          <TopbarActionsSlot />
        </div>
        <GroupsPage onOpenGroupStickers={onOpenGroupStickers} />
      </TopbarActionsProvider>
    </ToastProvider>,
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
  await act(() => reloadPersonal());
}

async function switchToCards() {
  await userEvent.click(screen.getByRole('radio', { name: 'Carduri' }));
}

describe('GroupsPage', () => {
  beforeEach(() => {
    // usePersistedState citește localStorage — fără curățare, testul care schimbă modul
    // ar „scurge” alegerea către testele care rulează după el.
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/personal/state') return jsonResponse(fixturePersonalState);
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
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

  it('pornește în Tablă și arată statistica din antet, cu „N fără grupă” evidențiat', async () => {
    await loadedSession();
    renderPage();

    const topbarSlot = screen.getByTestId('topbar-slot');
    expect(within(topbarSlot).getByRole('radio', { name: 'Tablă', checked: true })).toBeInTheDocument();
    expect(
      within(topbarSlot).getByText(
        (_, element) => element?.textContent === '2 grupe · 2 copii în grupe · 1 fără grupă',
      ),
    ).toBeInTheDocument();
    // Tablă implicit: panoul „Fără grupă” și tile-urile grupelor sunt vizibile.
    expect(screen.getByText('Fără grupă')).toBeInTheDocument();
    expect(screen.getByText('Fluturași')).toBeInTheDocument();
  });

  it('„+ Grupă nouă” e prezent în antet în ambele moduri, fără cardul punctat din grilă', async () => {
    await loadedSession();
    renderPage();

    const topbarSlot = screen.getByTestId('topbar-slot');
    expect(within(topbarSlot).getByRole('button', { name: '+ Grupă nouă' })).toBeInTheDocument();

    await switchToCards();

    expect(within(topbarSlot).getByRole('button', { name: '+ Grupă nouă' })).toBeInTheDocument();
    expect(screen.queryByText('Grupă nouă', { selector: 'span' })).not.toBeInTheDocument();
  });

  it('un singur editor e deschis o dată, la click pe un card din Carduri', async () => {
    await loadedSession();
    renderPage();
    await switchToCards();

    expect(screen.getByText(/^Copii în grupă · 2/)).toBeInTheDocument();

    await userEvent.click(screen.getByText('Ursuleți'));
    expect(screen.getByText('Copii în grupă · 0')).toBeInTheDocument();
    expect(screen.queryByText(/^Copii în grupă · 2/)).not.toBeInTheDocument();
  });

  // 13b (m10): editarea numelui/educatorului/capacității în editorul grupei trebuie înregistrată
  // ca formular nesalvat, altfel operatorul pierde modificările la un „Salvează și schimbă” de filială.
  it('editorul grupei devine „nesalvat" după modificarea educatorului (13b)', async () => {
    await loadedSession();
    renderPage();
    await switchToCards();

    expect(readDirtyForms()).toEqual([]);

    await userEvent.type(screen.getByLabelText('Educator'), ' Popescu');

    const [dirtyForm] = readDirtyForms();
    expect(dirtyForm.label).toBe('o grupă');
  });

  it('creează o grupă nouă din antet și o selectează automat', async () => {
    await loadedSession();
    renderPage();

    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/api/record') {
        const body = JSON.parse((options!.body as string) ?? '{}');
        const nextState =
          body.mode === 'create' && body.type === 'groups'
            ? { ...fixtureState, groups: [...fixtureState.groups, body.record] }
            : fixtureState;
        return jsonResponse({ state: nextState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
      }
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
      if (path === '/api/health') return jsonResponse({});
      if (path === '/api/personal/state') return jsonResponse(fixturePersonalState);
      throw new Error(`neașteptat: ${path}`);
    });

    await userEvent.click(screen.getByRole('button', { name: '+ Grupă nouă' }));
    await userEvent.type(screen.getByLabelText('Nume grupă'), 'Pinguini');
    await userEvent.click(screen.getByRole('button', { name: 'Creează grupa' }));

    expect(await screen.findByText('Grupa Pinguini a fost creată')).toBeInTheDocument();
  });

  it('atribuie un copil fără grupă din editor (Carduri)', async () => {
    await loadedSession();
    renderPage();
    await switchToCards();

    await userEvent.click(screen.getByText('Ursuleți'));

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_path: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      expect(body.record.id).toBe('c4');
      expect(body.record.groupId).toBe('g2');
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await userEvent.click(screen.getByRole('button', { name: 'Copil fără grupă' }));
    await userEvent.click(screen.getByText('Vlad Marin'));
    // Primul „+ Adaugă” e cel al copiilor fără grupă; al doilea e cel al Echipei grupei (23i).
    await userEvent.click(screen.getAllByRole('button', { name: '+ Adaugă' })[0]);

    expect(await screen.findByText('Copil atribuit grupei.')).toBeInTheDocument();
  });

  it('echipa grupei (23i) apare în editorul grupei și se salvează cu Group.team', async () => {
    await loadedSession();
    renderPage();
    await switchToCards();

    const teamCard = screen.getByText('Echipa grupei').parentElement!;

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_path: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      expect(body.type).toBe('groups');
      expect(body.record.id).toBe('g1');
      expect(body.record.team).toEqual([{ staffId: 'STF-1', role: 'asistent' }]);
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    const staffSelect = within(teamCard).getAllByRole('combobox')[0];
    await userEvent.selectOptions(staffSelect, 'STF-1');
    await userEvent.click(within(teamCard).getByRole('button', { name: '+ Adaugă' }));
    await userEvent.click(within(teamCard).getByRole('button', { name: 'Salvează echipa' }));

    expect(await screen.findByText('Echipa grupei a fost salvată.')).toBeInTheDocument();
  });

  // 13b (m10): adăugarea unui membru în echipa grupei, înainte de „Salvează echipa”, trebuie
  // înregistrată ca formular nesalvat.
  it('echipa grupei devine „nesalvată" după adăugarea unui membru, înainte de Salvează (13b)', async () => {
    await loadedSession();
    renderPage();
    await switchToCards();

    const teamCard = screen.getByText('Echipa grupei').parentElement!;
    expect(readDirtyForms()).toEqual([]);

    const staffSelect = within(teamCard).getAllByRole('combobox')[0];
    await userEvent.selectOptions(staffSelect, 'STF-1');
    await userEvent.click(within(teamCard).getByRole('button', { name: '+ Adaugă' }));

    const dirtyForm = readDirtyForms().find(form => form.label === 'o echipă de grupă');
    expect(dirtyForm).toBeDefined();
  });

  it('cere navigarea la stickerele grupei din meniul ⋯ al tile-ului din Tablă, fără să deschidă editorul', async () => {
    await loadedSession();
    const onOpenGroupStickers = vi.fn();
    renderPage(onOpenGroupStickers);

    const menu = screen.getByLabelText('Acțiuni grupa Fluturași').closest('details')!;
    await userEvent.click(screen.getByLabelText('Acțiuni grupa Fluturași'));
    await userEvent.click(within(menu).getByRole('button', { name: 'Stickere pentru grupă' }));

    expect(onOpenGroupStickers).toHaveBeenCalledWith('g1');
    expect(screen.queryByText(/^Copii în grupă/)).not.toBeInTheDocument();
  });
});
