import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { useChildrenCsvImport } from './useChildrenCsvImport';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] };

const previewReport = {
  total: 1,
  additions: [{ id: 'CSV-10', name: 'Radu Ionescu', contractNumber: '10' }],
  rows: [
    {
      line: 2,
      id: 'CSV-10',
      name: 'Radu Ionescu',
      contractNumber: '10',
      parent: '',
      phone: '',
      parent2: '',
      phone2: '',
      birthDate: '',
      attendanceDate: '',
      action: 'add',
      reason: '',
      warnings: [],
    },
  ],
  errors: [],
  warnings: [],
  skipped: 0,
  conflicts: 0,
  revision: 1,
};

function csvFile(content: string) {
  return new File([content], 'copii.csv', { type: 'text/csv' });
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
  return session;
}

describe('useChildrenCsvImport', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/children-csv-preview') return jsonResponse(previewReport);
        if (path === '/api/children-csv') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          expect(body.confirm).toBe('IMPORT COPII');
          return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pickFile previzualizează CSV-ul prin server', async () => {
    await loadedSession();
    const { result } = renderHook(() => useChildrenCsvImport());

    result.current.openDialog();
    await act(() => result.current.pickFile(csvFile('Nr. contract,Nume\n10,Radu Ionescu\n')));

    expect(result.current.report?.additions).toHaveLength(1);
    expect(result.current.error).toBe('');
  });

  it('fișier peste 2MB respinge fără cerere către server', async () => {
    await loadedSession();
    const { result } = renderHook(() => useChildrenCsvImport());

    const big = new File([new Uint8Array(2_000_001)], 'copii.csv');
    await act(() => result.current.pickFile(big));

    expect(result.current.error).toBe('Fișier prea mare (maximum 2 MB).');
    expect(result.current.report).toBeNull();
  });

  it('canCommit rămâne fals până se scrie exact IMPORT COPII', async () => {
    await loadedSession();
    const { result } = renderHook(() => useChildrenCsvImport());

    result.current.openDialog();
    await act(() => result.current.pickFile(csvFile('Nr. contract,Nume\n10,Radu Ionescu\n')));

    expect(result.current.canCommit).toBe(false);
    act(() => result.current.setConfirmText('IMPORT COPII'));
    expect(result.current.canCommit).toBe(true);
  });

  it('commit trimite csv-ul și fraza de confirmare, apoi închide dialogul', async () => {
    await loadedSession();
    const { result } = renderHook(() => useChildrenCsvImport());

    result.current.openDialog();
    await act(() => result.current.pickFile(csvFile('Nr. contract,Nume\n10,Radu Ionescu\n')));
    act(() => result.current.setConfirmText('IMPORT COPII'));

    let outcome: { imported: number } | undefined;
    await act(async () => {
      outcome = await result.current.commit();
    });

    expect(outcome?.imported).toBe(1);
    expect(result.current.open).toBe(false);
  });
});
