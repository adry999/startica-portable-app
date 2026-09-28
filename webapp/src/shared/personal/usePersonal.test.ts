import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reloadPersonal, usePersonal } from './usePersonal';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = {
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

describe('usePersonal', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/personal/state') return jsonResponse(fixtureState);
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('încarcă echipa, funcțiile și departamentele o singură dată și le pune la dispoziție prin staffById/roleName', async () => {
    await act(() => reloadPersonal());
    const { result } = renderHook(() => usePersonal());

    expect(result.current.status).toBe('ready');
    expect(result.current.staffById.get('STF-1')?.name).toBe('Ana Popescu');
    expect(result.current.roleName('ROL-1')).toBe('Educator');
    expect(result.current.departmentName('DEP-1')).toBe('Educatori');
    expect(result.current.roleDepartmentId('ROL-1')).toBe('DEP-1');
  });

  it('o cerere eșuată pune ecranul pe „failed” cu mesajul serverului', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: 'Eroare server' }) })),
    );
    await act(() => reloadPersonal());
    const { result } = renderHook(() => usePersonal());
    // m11: un eșec resetează `bootstrapped`, deci acest nou montaj reîncearcă automat (trece prin
    // „loading” din nou) înainte să se stabilizeze pe „failed”, cu server-ul tot picat.
    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(result.current.failureMessage).toBe('Eroare server');
  });

  // m11: după un eșec, `bootstrapped` rămâne true pentru totdeauna — toate ecranele Personal
  // rămâneau pe „failed" până la reload complet al aplicației, chiar dacă operatorul naviga la
  // alt ecran Personal (un nou montaj al hook-ului ar trebui să reîncerce automat).
  it('un eșec permite reîncercarea automată la un montaj ulterior, nu doar reload() manual', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: 'Eroare server' }) })),
    );
    await act(() => reloadPersonal());
    const first = renderHook(() => usePersonal());
    // m11: montajul reîncearcă automat (bootstrapped a fost resetat de reloadPersonal eșuat mai sus)
    // înainte să se stabilizeze din nou pe „failed", cu server-ul tot picat.
    await waitFor(() => expect(first.result.current.status).toBe('failed'));
    first.unmount();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/personal/state') return jsonResponse(fixtureState);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    // Simulează navigarea la un alt ecran Personal (ex. de la Echipa la Pontaj) — un nou montaj
    // al hook-ului, fără să apeleze explicit reload().
    const second = renderHook(() => usePersonal());
    await waitFor(() => expect(second.result.current.status).toBe('ready'));
    expect(second.result.current.staffById.get('STF-1')?.name).toBe('Ana Popescu');
  });
});
