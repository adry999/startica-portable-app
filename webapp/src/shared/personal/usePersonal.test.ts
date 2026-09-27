import { act, renderHook } from '@testing-library/react';
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
    expect(result.current.status).toBe('failed');
    expect(result.current.failureMessage).toBe('Eroare server');
  });
});
