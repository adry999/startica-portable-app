import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { useGroups } from './useGroups';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// Fixtură: o grupă plină (2/2), una goală (0/5) și una fără capacitate setată
// (1/—), plus un copil nearhivat fără grupă.
const fixtureState = {
  children: [
    { id: 'c1', name: 'Andrei Popescu', groupId: 'g1', birthDate: '2020-09-24', archived: false },
    { id: 'c2', name: 'Maria Ionescu', groupId: 'g1', birthDate: '2019-01-15', archived: false },
    { id: 'c3', name: 'Bianca Stan', groupId: 'g3', birthDate: '2021-05-01', archived: false },
    { id: 'c4', name: 'Vlad Marin', groupId: null, birthDate: '2020-01-01', archived: false },
    { id: 'c5', name: 'Arhivat Vechi', groupId: 'g1', birthDate: '2018-01-01', archived: true },
  ],
  payments: [],
  expenses: [],
  groups: [
    { id: 'g1', name: 'Fluturași', capacity: 2, educator: 'Ioana' },
    { id: 'g2', name: 'Ursuleți', capacity: 5, educator: 'Maria' },
    { id: 'g3', name: 'Steluțe', capacity: null, educator: '' },
  ],
  categories: [],
  visits: [],
};

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
  return session;
}

describe('useGroups', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('e loading înainte ca sesiunea să fie gata', () => {
    const { result } = renderHook(() => useGroups());
    expect(result.current.status).toBe('loading');
  });

  it('randează grupele sortate alfabetic, cu ocupare și copii arhivați excluși', async () => {
    await loadedSession();
    const { result } = renderHook(() => useGroups());

    expect(result.current.status).toBe('ready');
    expect(result.current.groups.map(g => g.name)).toEqual(['Fluturași', 'Steluțe', 'Ursuleți']);

    const fluturasi = result.current.groups[0];
    expect(fluturasi.occupancyLabel).toBe('2/2');
    expect(fluturasi.memberCount).toBe(2);
    expect(fluturasi.overCapacity).toBe(false);

    const steluteFara = result.current.groups[1];
    expect(steluteFara.occupancyLabel).toBe('1/—');
    expect(steluteFara.occupancyPercent).toBe(0);

    const ursuleti = result.current.groups[2];
    expect(ursuleti.occupancyLabel).toBe('0/5');
    expect(ursuleti.memberCount).toBe(0);
    expect(ursuleti.ageRangeLabel).toBe('—');
    expect(ursuleti.members).toEqual([]);
  });

  it('listează doar copiii nearhivați fără grupă în unassignedChildren', async () => {
    await loadedSession();
    const { result } = renderHook(() => useGroups());

    expect(result.current.unassignedChildren).toEqual([{ id: 'c4', name: 'Vlad Marin' }]);
  });

  it('toggleGroup deschide și închide un singur editor la un moment dat', async () => {
    await loadedSession();
    const { result } = renderHook(() => useGroups());

    act(() => result.current.toggleGroup('g1'));
    expect(result.current.openGroupId).toBe('g1');

    act(() => result.current.toggleGroup('g2'));
    expect(result.current.openGroupId).toBe('g2');

    act(() => result.current.toggleGroup('g2'));
    expect(result.current.openGroupId).toBeNull();
  });

  it('createGroup trimite mutația de creare cu id GRP- generat', async () => {
    await loadedSession();
    const { result } = renderHook(() => useGroups());

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_path: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      expect(body.type).toBe('groups');
      expect(body.mode).toBe('create');
      expect(body.record.name).toBe('Pinguini');
      expect(body.record.capacity).toBe(8);
      expect(body.record.id).toMatch(/^GRP-/);
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await act(() => result.current.createGroup('Pinguini', '8'));
  });

  it('createGroup respinge un nume gol fără să trimită cererea', async () => {
    await loadedSession();
    const { result } = renderHook(() => useGroups());

    await expect(result.current.createGroup('   ', '')).rejects.toThrow('Completează numele grupei.');
  });

  it('assignChild trimite actualizarea copilului cu noul groupId', async () => {
    await loadedSession();
    const { result } = renderHook(() => useGroups());

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_path: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      expect(body.type).toBe('children');
      expect(body.mode).toBe('update');
      expect(body.record.id).toBe('c4');
      expect(body.record.groupId).toBe('g2');
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await act(() => result.current.assignChild('g2', 'c4'));
  });

  it('removeChild golește groupId-ul copilului', async () => {
    await loadedSession();
    const { result } = renderHook(() => useGroups());

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_path: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      expect(body.record.id).toBe('c1');
      expect(body.record.groupId).toBeNull();
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await act(() => result.current.removeChild('c1'));
  });

  it('deleteGroup cheamă /api/group-delete și închide editorul dacă era deschis', async () => {
    await loadedSession();
    const { result } = renderHook(() => useGroups());
    act(() => result.current.toggleGroup('g1'));

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (path: string, options: RequestInit) => {
      expect(path).toBe('/api/group-delete');
      const body = JSON.parse(options.body as string);
      expect(body.id).toBe('g1');
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await act(() => result.current.deleteGroup('g1'));
    expect(result.current.openGroupId).toBeNull();
  });
});
