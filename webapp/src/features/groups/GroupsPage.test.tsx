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
    {
      id: 'STF-2',
      name: 'Ion Rusu',
      roleId: 'ROL-1',
      branchIds: ['alta-filiala'],
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
        if (path === '/api/session')
          return jsonResponse({ token: 'tok', version: '1.6.3', branch: { id: 'bu', name: 'Buiucani', color: '' } });
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

  // 13b (m10): editarea numelui/capacității în editorul grupei trebuie înregistrată ca formular
  // nesalvat, altfel operatorul pierde modificările la un „Salvează și schimbă” de filială.
  it('editorul grupei devine „nesalvat" după modificarea numelui (13b)', async () => {
    await loadedSession();
    renderPage();
    await switchToCards();

    expect(readDirtyForms()).toEqual([]);

    await userEvent.type(screen.getByLabelText('Nume grupă'), ' Popescu');

    const [dirtyForm] = readDirtyForms();
    expect(dirtyForm.label).toBe('o grupă');
  });

  // F20 (PROMPT-11 §8.2): „Salvează” inactiv până la prima modificare.
  it('„Salvează” e inactiv fără nicio modificare și devine activ după ce editezi numele', async () => {
    await loadedSession();
    renderPage();
    await switchToCards();

    expect(screen.getByRole('button', { name: 'Salvează' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Nume grupă'), ' Popescu');

    expect(screen.getByRole('button', { name: 'Salvează' })).toBeEnabled();
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
      if (path === '/api/session')
        return jsonResponse({ token: 'tok', version: '1.6.3', branch: { id: 'bu', name: 'Buiucani', color: '' } });
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

    expect(await screen.findByText('Copil atribuit grupei.')).toBeInTheDocument();
  });

  it('redenumirea grupei din Carduri trimite noul nume la salvare, fără să fie suprascris de saveTeam', async () => {
    await loadedSession();
    renderPage();
    await switchToCards();

    const calls: unknown[] = [];
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/api/record') {
        const body = JSON.parse((options!.body as string) ?? '{}');
        calls.push(body);
        return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
      }
      if (path === '/api/session')
        return jsonResponse({ token: 'tok', version: '1.6.3', branch: { id: 'bu', name: 'Buiucani', color: '' } });
      if (path === '/api/health') return jsonResponse({});
      if (path === '/api/personal/state') return jsonResponse(fixturePersonalState);
      throw new Error(`neașteptat: ${path}`);
    });

    const nameInput = screen.getByLabelText('Nume grupă') as HTMLInputElement;
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Fluturași Mari');
    await userEvent.click(screen.getByRole('button', { name: 'Salvează' }));

    expect(await screen.findByText('Grupă actualizată.')).toBeInTheDocument();
    // O singură mutație (name + team împreună) — nu updateGroup urmat de saveTeam, care ar
    // retrimite numele vechi din `records.groups` neactualizat încă (vezi comentariul din useGroups.ts).
    expect(calls).toHaveLength(1);
    const lastCall = calls.at(-1) as { type: string; record: { id: string; name: string } };
    expect(lastCall.record.name).toBe('Fluturași Mari');
  });

  it('echipa grupei (§5c) apare în editorul grupei și se salvează cu Group.team la „Salvează” (4a)', async () => {
    await loadedSession();
    renderPage();
    await switchToCards();

    const teamCard = screen.getByText(/Echipa grupei/).closest('div')!.parentElement as HTMLElement;

    const calls: unknown[] = [];
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/api/record') {
        const body = JSON.parse((options!.body as string) ?? '{}');
        calls.push(body);
        return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
      }
      if (path === '/api/session')
        return jsonResponse({ token: 'tok', version: '1.6.3', branch: { id: 'bu', name: 'Buiucani', color: '' } });
      if (path === '/api/health') return jsonResponse({});
      if (path === '/api/personal/state') return jsonResponse(fixturePersonalState);
      throw new Error(`neașteptat: ${path}`);
    });

    await userEvent.click(within(teamCard).getByRole('button', { name: '+ Asistent' }));
    await userEvent.click(within(teamCard).getByRole('button', { name: /Ana Popescu/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvează' }));

    expect(await screen.findByText('Grupă actualizată.')).toBeInTheDocument();
    // onSave trimite name + team într-o singură mutație (vezi testul de redenumire de mai sus).
    expect(calls).toHaveLength(1);
    const lastCall = calls.at(-1) as { type: string; record: { id: string; team: unknown } };
    expect(lastCall.record.team).toEqual([{ staffId: 'STF-1', role: 'asistent' }]);
  });

  // F20 (PROMPT-11 §8.3): „Echipa grupei” înaintea „Copii în grupă”, nu după cum era înainte.
  it('„Echipa grupei” apare înaintea „Copii în grupă” în editor', async () => {
    await loadedSession();
    renderPage();
    await switchToCards();

    const teamIndex = screen.getByText(/Echipa grupei/).compareDocumentPosition(screen.getByText(/Copii în grupă/));
    // Node.DOCUMENT_POSITION_FOLLOWING (4) — „Copii în grupă” vine după „Echipa grupei” în DOM.
    expect(teamIndex & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // F29 (DECIZII 02.10): echipa grupei se alege doar din angajații filialei deschise.
  it('F29: GroupTeamPicker nu arată angajații din alte filiale', async () => {
    await loadedSession();
    renderPage();
    await switchToCards();

    const teamCard = screen.getByText(/Echipa grupei/).closest('div')!.parentElement as HTMLElement;
    await userEvent.click(within(teamCard).getByRole('button', { name: '+ Asistent' }));

    expect(within(teamCard).getByRole('button', { name: /Ana Popescu/ })).toBeInTheDocument();
    expect(within(teamCard).queryByText(/Ion Rusu/)).not.toBeInTheDocument();
  });

  // 13b (m10): adăugarea unui membru în echipa grupei, înainte de „Salvează”, trebuie
  // înregistrată ca formular nesalvat (combinat cu numele/capacitatea).
  it('echipa grupei devine „nesalvată" după adăugarea unui membru, înainte de Salvează (13b)', async () => {
    await loadedSession();
    renderPage();
    await switchToCards();

    const teamCard = screen.getByText(/Echipa grupei/).closest('div')!.parentElement as HTMLElement;
    expect(readDirtyForms()).toEqual([]);

    await userEvent.click(within(teamCard).getByRole('button', { name: '+ Asistent' }));
    await userEvent.click(within(teamCard).getByRole('button', { name: /Ana Popescu/ }));

    const dirtyForm = readDirtyForms().find(form => form.label === 'o grupă');
    expect(dirtyForm).toBeDefined();
  });

  // F5 (FEEDBACK-01-10.md): editorul inițializa starea o singură dată (useState(group.name))
  // — la schimbarea grupei selectate, numele/capacitatea/echipa rămâneau ale grupei anterioare.
  it('editorul arată numele și capacitatea grupei nou selectate, nu ale celei dinainte (F5)', async () => {
    await loadedSession();
    renderPage();
    await switchToCards();

    expect(screen.getByLabelText('Nume grupă')).toHaveValue('Fluturași');
    expect(screen.getByLabelText('Capacitate')).toHaveValue(2);

    await userEvent.click(screen.getByText('Ursuleți'));

    expect(screen.getByLabelText('Nume grupă')).toHaveValue('Ursuleți');
    expect(screen.getByLabelText('Capacitate')).toHaveValue(5);
  });

  // F5: o modificare nesalvată pe grupa curentă nu trebuie pierdută tăcut la click pe altă grupă.
  it('cere confirmare înainte să schimbe grupa selectată, dacă editorul e nesalvat (F5)', async () => {
    await loadedSession();
    renderPage();
    await switchToCards();

    await userEvent.type(screen.getByLabelText('Nume grupă'), ' Popescu');
    await userEvent.click(screen.getByText('Ursuleți'));

    expect(screen.getByRole('dialog', { name: /Renunți la modificările din grupa Fluturași/ })).toBeInTheDocument();
    // Editorul rămâne pe grupa veche până se alege o opțiune din dialog.
    expect(screen.getByLabelText('Nume grupă')).toHaveValue('Fluturași Popescu');

    await userEvent.click(screen.getByRole('button', { name: 'Rămân' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nume grupă')).toHaveValue('Fluturași Popescu');

    await userEvent.click(screen.getByText('Ursuleți'));
    await userEvent.click(screen.getByRole('button', { name: 'Renunță' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nume grupă')).toHaveValue('Ursuleți');
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
