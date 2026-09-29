import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { readDirtyForms } from '@shared/state/dirty-forms';
import { reloadPersonal } from '@shared/personal/usePersonal';
import { __resetSyncStatusForTests } from '@shared/api/useSyncStatus';
import { RolesDrawer } from './RolesDrawer';

// usePersonal se abonează la useSyncStatus, care deschide un EventSource real spre
// /api/sync/events dacă nu e stubuit (ca în useSyncStatus.test.ts) — fără asta, conexiunea
// eșuează asincron și poate lovi mock-ul de fetch chiar în timpul cleanup-ului RTL, atribuind
// eroarea testului curent la întâmplare (flaky, mai ales cu teste mai multe/mai lungi în fișier).
class FakeEventSource {
  onerror: (() => void) | null = null;
  addEventListener() {}
  close() {}
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixturePersonalState = {
  departments: [{ id: 'DEP-1', name: 'Educatori', order: 1 }],
  roles: [
    { id: 'ROL-1', name: 'Educator', departmentId: 'DEP-1', order: 1 },
    { id: 'ROL-2', name: 'Asistent educator', departmentId: 'DEP-1', order: 2 },
  ],
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

function stubFetch() {
  const mock = vi.fn(async (path: string, init?: { body?: string }) => {
    if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3', branch: null, branches: [] });
    if (path === '/api/state')
      return jsonResponse({
        state: { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] },
        revision: 1,
        updatedAt: '2026-09-23T10:00:00Z',
      });
    if (path === '/api/health') return jsonResponse({});
    if (path === '/api/personal/state') return jsonResponse(fixturePersonalState);
    if (path === '/api/personal/roles')
      return jsonResponse({ departments: fixturePersonalState.departments, roles: fixturePersonalState.roles });
    if (path === '/api/personal/settings')
      return jsonResponse({ settings: init?.body ? JSON.parse(init.body) : fixturePersonalState.settings });
    throw new Error(`neașteptat: ${path}`);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('RolesDrawer', () => {
  beforeEach(() => {
    __resetSyncStatusForTests();
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
    stubFetch();
  });
  afterEach(() => {
    __resetSyncStatusForTests();
    vi.unstubAllGlobals();
  });

  it('o funcție cu angajați nu are buton de ștergere activ', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <RolesDrawer open onClose={() => {}} />
      </ToastProvider>,
    );

    const educatorRow = (await screen.findByDisplayValue('Educator')).closest('li')!;
    const removeButton = educatorRow.querySelector('button')!;
    expect(removeButton).toBeDisabled();

    const asistentRow = screen.getByDisplayValue('Asistent educator').closest('li')!;
    const asistentRemove = asistentRow.querySelector('button')!;
    expect(asistentRemove).not.toBeDisabled();
  });

  // 13b (m10): editarea unui departament/funcție trebuie înregistrată ca formular nesalvat,
  // altfel operatorul pierde modificările la un „Salvează și schimbă” de filială.
  it('formularul devine „nesalvat" după redenumirea unui departament (13b)', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <RolesDrawer open onClose={() => {}} />
      </ToastProvider>,
    );

    await screen.findByDisplayValue('Educator');
    expect(readDirtyForms()).toEqual([]);

    // „Educatori” apare și ca text de opțiune în select-ul de funcție nouă — luăm câmpul de nume.
    const [departmentInput] = screen.getAllByDisplayValue('Educatori');
    await userEvent.type(departmentInput, ' II');

    const [dirtyForm] = readDirtyForms();
    expect(dirtyForm.label).toBe('o modificare la funcții');
  });

  // A3f (verificarea 5, ALINIERE-DESIGN.md): backend + hook existau deja (`/api/personal/settings`,
  // `usePersonal().saveSettings`), dar niciun câmp din UI nu le folosea — adăugate aici.
  it('A3f: setările „Zile de concediu anual” și „doar absențe nemotivate” se salvează prin /api/personal/settings', async () => {
    await loadedSession();
    await act(() => reloadPersonal());
    const fetchMock = stubFetch();

    render(
      <ToastProvider>
        <RolesDrawer open onClose={() => {}} />
      </ToastProvider>,
    );

    const daysInput = await screen.findByLabelText('Zile de concediu anual');
    expect(daysInput).toHaveValue(28);
    const checkbox = screen.getByLabelText(/Scade din salariu doar absențele nemotivate/);
    expect(checkbox).toBeChecked();

    await userEvent.clear(daysInput);
    await userEvent.type(daysInput, '21');
    await userEvent.click(checkbox);

    await userEvent.click(screen.getByRole('button', { name: 'Salvează' }));

    const settingsCall = fetchMock.mock.calls.find(([path]) => path === '/api/personal/settings');
    expect(settingsCall).toBeDefined();
    expect(JSON.parse((settingsCall![1] as { body: string }).body)).toEqual({
      annualLeaveDays: 21,
      deductOnlyUnexcused: false,
    });
  });

  it('A3f: „Zile de concediu anual” în afara [0, 365] dezactivează Salvează', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <RolesDrawer open onClose={() => {}} />
      </ToastProvider>,
    );

    const daysInput = await screen.findByLabelText('Zile de concediu anual');
    await userEvent.clear(daysInput);
    await userEvent.type(daysInput, '400');

    expect(screen.getByRole('button', { name: 'Salvează' })).toBeDisabled();
  });
});
