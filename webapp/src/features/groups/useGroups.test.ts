import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { useGroups } from './useGroups';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// Fixtură: o grupă plină (2/2), una goală (0/5) și una fără capacitate setată
// (1/—), plus doi copii nearhivați fără grupă cu vârste diferite.
const fixtureState = {
  children: [
    { id: 'c1', name: 'Andrei Popescu', groupId: 'g1', birthDate: '2020-09-24', archived: false },
    { id: 'c2', name: 'Maria Ionescu', groupId: 'g1', birthDate: '2019-01-15', archived: false },
    { id: 'c3', name: 'Bianca Stan', groupId: 'g3', birthDate: '2021-05-01', archived: false },
    { id: 'c4', name: 'Vlad Marin', groupId: null, birthDate: '2020-01-01', archived: false },
    { id: 'c6', name: 'Sofia Ilie', groupId: null, birthDate: '2022-06-01', archived: false },
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

function recordCallsTo(type: string) {
  return (fetch as ReturnType<typeof vi.fn>).mock.calls
    .filter(([path]) => path === '/api/record')
    .map(([, options]) => JSON.parse((options as RequestInit).body as string))
    .filter(body => body.type === type);
}

describe('useGroups', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/record')
          return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('e loading înainte ca sesiunea să fie gata', () => {
    const { result } = renderHook(() => useGroups());
    expect(result.current.status).toBe('loading');
  });

  it('randează grupele sortate alfabetic (fallback, fără `order`), cu ocupare, ton și stare', async () => {
    await loadedSession();
    const { result } = renderHook(() => useGroups());

    expect(result.current.status).toBe('ready');
    expect(result.current.groups.map(g => g.name)).toEqual(['Fluturași', 'Steluțe', 'Ursuleți']);

    const fluturasi = result.current.groups[0];
    expect(fluturasi.occupancyLabel).toBe('2/2');
    expect(fluturasi.memberCount).toBe(2);
    expect(fluturasi.overCapacity).toBe(false);
    expect(fluturasi.capacityState).toBe('full');
    expect(fluturasi.tone).toBe('yellow');

    const stelute = result.current.groups[1];
    expect(stelute.occupancyLabel).toBe('1/—');
    expect(stelute.occupancyPercent).toBe(0);
    expect(stelute.capacityState).toBeNull();

    const ursuleti = result.current.groups[2];
    expect(ursuleti.occupancyLabel).toBe('0/5');
    expect(ursuleti.memberCount).toBe(0);
    expect(ursuleti.ageRangeLabel).toBe('—');
    expect(ursuleti.members).toEqual([]);
    expect(ursuleti.capacityState).toBe('empty');
    // 3 grupe fără `order`/`tone` explicit → tonuri distincte din poziția alfabetică.
    expect(new Set(result.current.groups.map(g => g.tone)).size).toBe(3);
  });

  it('listează doar copiii nearhivați fără grupă, ordonați după vârstă (cei mai mici întâi)', async () => {
    await loadedSession();
    const { result } = renderHook(() => useGroups());

    expect(result.current.unassignedChildren.map(child => child.id)).toEqual(['c6', 'c4']);
    expect(result.current.unassignedChildren[0]).toMatchObject({ id: 'c6', name: 'Sofia Ilie' });
    expect(result.current.unassignedChildren[0].ageLabel).toBeTruthy();
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

  it('createGroup trimite mutația de creare cu id GRP- generat, order 0 și tone, apoi întoarce id-ul', async () => {
    await loadedSession();
    const { result } = renderHook(() => useGroups());

    let newId = '';
    await act(async () => {
      newId = await result.current.createGroup('Pinguini', '8', { tone: 'teal' });
    });

    expect(newId).toMatch(/^GRP-/);
    const [createCall] = recordCallsTo('groups').filter(body => body.mode === 'create');
    expect(createCall.record.name).toBe('Pinguini');
    expect(createCall.record.capacity).toBe(8);
    expect(createCall.record.order).toBe(0);
    expect(createCall.record.tone).toBe('teal');
    expect(createCall.record.id).toBe(newId);
  });

  it('createGroup respinge un nume gol fără să trimită cererea', async () => {
    await loadedSession();
    const { result } = renderHook(() => useGroups());

    await expect(result.current.createGroup('   ', '')).rejects.toThrow('Completează numele grupei.');
  });

  it('createGroup respinge un nume deja folosit în filială', async () => {
    await loadedSession();
    const { result } = renderHook(() => useGroups());

    await expect(result.current.createGroup('fluturași', '8')).rejects.toThrow('Există deja o grupă fluturași.');
  });

  it('createGroup pune grupa nouă prima (order 0) și coboară restul grupelor cu o poziție', async () => {
    await loadedSession();
    const { result } = renderHook(() => useGroups());

    await act(async () => {
      await result.current.createGroup('Pinguini', '8');
    });

    const updates = recordCallsTo('groups').filter(body => body.mode === 'update');
    const orderById = Object.fromEntries(updates.map(body => [body.record.id, body.record.order]));
    // Ordinea alfabetică de fallback era Fluturași(g1), Steluțe(g3), Ursuleți(g2) → 1,2,3.
    expect(orderById).toEqual({ g1: 1, g3: 2, g2: 3 });
  });

  it('assignChild trimite actualizarea copilului cu noul groupId', async () => {
    await loadedSession();
    const { result } = renderHook(() => useGroups());

    await act(() => result.current.assignChild('g2', 'c4'));

    const [body] = recordCallsTo('children');
    expect(body.record.id).toBe('c4');
    expect(body.record.groupId).toBe('g2');
  });

  it('removeChild golește groupId-ul copilului', async () => {
    await loadedSession();
    const { result } = renderHook(() => useGroups());

    await act(() => result.current.removeChild('c1'));

    const [body] = recordCallsTo('children');
    expect(body.record.id).toBe('c1');
    expect(body.record.groupId).toBeNull();
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

  it('reorderGroups persistă `order` 0..N-1 pentru grupele a căror poziție s-a schimbat', async () => {
    await loadedSession();
    const { result } = renderHook(() => useGroups());

    await act(async () => {
      await result.current.reorderGroups('g2', 'g1');
    });

    // Fallback alfabetic: Fluturași(g1)=0, Steluțe(g3)=1, Ursuleți(g2)=2 → după mutarea lui
    // g2 înaintea lui g1: g2=0, g1=1, g3=2.
    const updates = recordCallsTo('groups').filter(body => body.mode === 'update');
    const orderById = Object.fromEntries(updates.map(body => [body.record.id, body.record.order]));
    expect(orderById).toEqual({ g2: 0, g1: 1, g3: 2 });
  });

  it('reorderGroups nu face nimic când id-urile sunt identice sau inexistente', async () => {
    await loadedSession();
    const { result } = renderHook(() => useGroups());

    await act(() => result.current.reorderGroups('g1', 'g1'));
    await act(() => result.current.reorderGroups('g1', 'inexistent'));

    expect(recordCallsTo('groups')).toEqual([]);
  });

  it('moveGroup mută grupa cu o poziție și persistă doar grupele afectate', async () => {
    await loadedSession();
    const { result } = renderHook(() => useGroups());

    await act(async () => {
      await result.current.moveGroup('g1', 1);
    });

    // Fluturași(g1) trece peste Steluțe(g3): g3=0, g1=1, g2=2 (nicio grupă nu avea `order`
    // explicit, deci toate trei se scriu — „migrarea” lazy de la prima reordonare).
    const updates = recordCallsTo('groups').filter(body => body.mode === 'update');
    const orderById = Object.fromEntries(updates.map(body => [body.record.id, body.record.order]));
    expect(orderById).toEqual({ g3: 0, g1: 1, g2: 2 });
  });
});
