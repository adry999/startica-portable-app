import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuditLog } from './useAuditLog';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const page1 = {
  entries: [
    {
      id: 2,
      occurredAt: '2026-09-20T10:00:00.000Z',
      action: 'completare-taxe',
      recordType: 'children',
      recordId: 'c1',
      before: { fee: 1000 },
      after: { fee: 1500 },
    },
  ],
  nextBeforeEntryId: 1,
};

const page2 = {
  entries: [
    {
      id: 1,
      occurredAt: '2026-09-19T10:00:00.000Z',
      action: 'creare',
      recordType: 'children',
      recordId: 'c1',
      before: null,
      after: { fee: 1000 },
    },
  ],
  nextBeforeEntryId: null,
};

describe('useAuditLog', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('e loading, apoi ready cu prima pagină și diferențele calculate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/audit') return jsonResponse(page1);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useAuditLog());
    expect(result.current.status).toBe('loading');

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].changes).toEqual([{ field: 'fee', beforeLabel: '1000', afterLabel: '1500' }]);
    expect(result.current.hasMore).toBe(true);
  });

  it('un răspuns fără intrări arată starea "empty"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ entries: [], nextBeforeEntryId: null })),
    );

    const { result } = renderHook(() => useAuditLog());
    await waitFor(() => expect(result.current.status).toBe('empty'));
  });

  it('loadMore adaugă pagina următoare fără să șteargă rândurile deja afișate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/audit') return jsonResponse(page1);
        if (path === '/api/audit?beforeEntryId=1') return jsonResponse(page2);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useAuditLog());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(result.current.rows.map(row => row.id)).toEqual([2, 1]);
    expect(result.current.hasMore).toBe(false);
  });

  it('un eșec de rețea la prima pagină trece ecranul pe "failed"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('rețea indisponibilă');
      }),
    );

    const { result } = renderHook(() => useAuditLog());
    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(result.current.failureMessage).toBeTruthy();
  });

  it('45a: cu un scope, cere /api/audit/scope cu perechile (tip, id) codate JSON', async () => {
    const fetchMock = vi.fn(async (path: string) => {
      if (path.startsWith('/api/audit/scope')) return jsonResponse(page1);
      throw new Error(`neașteptat: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const scope = [{ recordType: 'children', recordId: 'c1' }];
    const { result } = renderHook(() => useAuditLog(scope));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const calledPath = fetchMock.mock.calls[0][0] as string;
    expect(calledPath).toContain('/api/audit/scope?scope=');
    expect(JSON.parse(decodeURIComponent(calledPath.split('scope=')[1]))).toEqual(scope);
  });

  it('45b: scope gol ([]) pune hook-ul în așteptare, fără nicio cerere', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('nu trebuia să ceară nimic');
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAuditLog([]));

    expect(result.current.status).toBe('loading');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('45a: loadMore cu scope păstrează scope-ul și adaugă beforeEntryId', async () => {
    const scope = [{ recordType: 'children', recordId: 'c1' }];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === `/api/audit/scope?scope=${encodeURIComponent(JSON.stringify(scope))}`) return jsonResponse(page1);
        if (path.includes('beforeEntryId=1')) return jsonResponse(page2);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useAuditLog(scope));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
  });
});
