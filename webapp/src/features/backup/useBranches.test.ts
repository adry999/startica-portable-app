import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BranchSummary } from '@shared/api/branches';
import { useBranches } from './useBranches';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const buiucani = {
  id: 'BR-1',
  name: 'Filiala Buiucani',
  color: 'orange',
  address: 'str. Exemplu 12',
  createdAt: '2026-01-01T00:00:00.000Z',
  folder: null,
  children: 10,
  groups: 2,
  lastLocal: '2026-09-27T10:00:00.000Z',
};
const botanica = {
  id: 'BR-2',
  name: 'Filiala Botanica',
  color: 'mint',
  address: 'bd. Exemplu 5',
  createdAt: '2026-02-01T00:00:00.000Z',
  folder: 'botanica',
  children: 0,
  groups: 0,
  lastLocal: '',
};

describe('useBranches', () => {
  let branches: BranchSummary[];

  beforeEach(() => {
    branches = [buiucani, botanica];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/branches' && init?.method !== 'POST')
          return jsonResponse({ activeBranchId: 'BR-1', branches });
        if (path === '/api/branches' && init?.method === 'POST') {
          const body = JSON.parse(String(init.body ?? '{}'));
          const created = {
            id: 'BR-3',
            color: 'orange',
            address: '',
            createdAt: '2026-09-27T00:00:00.000Z',
            folder: 'noua',
            ...body,
          };
          branches = [...branches, { ...created, children: 0, groups: 0, lastLocal: '' }];
          return jsonResponse({ branch: created });
        }
        if (path === '/api/branches/update' && init?.method === 'POST') {
          const body = JSON.parse(String(init.body ?? '{}'));
          branches = branches.map(branch => (branch.id === body.id ? { ...branch, ...body } : branch));
          const updated = branches.find(branch => branch.id === body.id);
          return jsonResponse({ branch: updated });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('nu e ready înainte de încărcare, apoi expune lista cu filiala activă', async () => {
    const { result } = renderHook(() => useBranches());
    expect(result.current.ready).toBe(false);

    await vi.waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.activeBranchId).toBe('BR-1');
    expect(result.current.branches).toHaveLength(2);
  });

  it('create adaugă o filială și reîmprospătează lista', async () => {
    const { result } = renderHook(() => useBranches());
    await vi.waitFor(() => expect(result.current.ready).toBe(true));

    await act(() => result.current.create({ name: 'Filiala Ciocana' }));

    expect(result.current.branches.some(branch => branch.name === 'Filiala Ciocana')).toBe(true);
  });

  it('rename și setColor trimit update și reîmprospătează lista', async () => {
    const { result } = renderHook(() => useBranches());
    await vi.waitFor(() => expect(result.current.ready).toBe(true));

    await act(() => result.current.rename('BR-2', 'Filiala Botanica Nouă'));
    expect(result.current.branches.find(branch => branch.id === 'BR-2')?.name).toBe('Filiala Botanica Nouă');

    await act(() => result.current.setColor('BR-2', 'pink'));
    expect(result.current.branches.find(branch => branch.id === 'BR-2')?.color).toBe('pink');
  });
});
