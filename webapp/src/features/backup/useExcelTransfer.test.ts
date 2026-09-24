import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { useAppSession } from '@shared/api/session';
import { exportWorkbook } from '#features/data-transfer/domain/excel-workbook.mjs';
import { useExcelTransfer } from './useExcelTransfer';
import type { RecordsSnapshot } from '@contracts/record-types.mjs';

const { writeFileMock } = vi.hoisted(() => ({ writeFileMock: vi.fn() }));
vi.mock('xlsx', async importOriginal => {
  const actual = await importOriginal<typeof import('xlsx')>();
  return { ...actual, writeFile: writeFileMock };
});

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = {
  children: [{ id: 'c1', name: 'Andrei Popescu', groupId: null, archived: false, feeHistory: [], notes: '' }],
  payments: [],
  expenses: [],
  groups: [],
  categories: [],
  visits: [],
} as unknown as RecordsSnapshot;

function exportedFile(state: RecordsSnapshot, name = 'export.xlsx') {
  const workbook = exportWorkbook(state, XLSX);
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([bytes], name);
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
  return session;
}

describe('useExcelTransfer', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/import-preview') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          return jsonResponse({
            state: body.state,
            summary: { children: 1, payments: 0, expenses: 0 },
            warnings: [],
            errors: [],
            notes: [],
          });
        }
        if (path === '/api/import') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          expect(body.confirm).toBe('IMPORT');
          return jsonResponse({ state: body.state, revision: 2, updatedAt: '2026-09-24T10:05:00Z' });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pickFile previzualizează un export Startica valid, revalidat de server', async () => {
    await loadedSession();
    const { result } = renderHook(() => useExcelTransfer());

    act(() => result.current.importDialog.openDialog());
    await act(() => result.current.importDialog.pickFile(exportedFile(fixtureState)));

    await waitFor(() => expect(result.current.importDialog.report).not.toBeNull());
    expect(result.current.importDialog.report?.errors).toEqual([]);
  });

  it('un fișier care nu e un export Startica valid arată erori, fără cerere către server', async () => {
    await loadedSession();
    const { result } = renderHook(() => useExcelTransfer());

    const fetchSpy = fetch as ReturnType<typeof vi.fn>;
    const callsBefore = fetchSpy.mock.calls.length;

    const garbage = new File(['nu e un xlsx'], 'garbage.xlsx');
    act(() => result.current.importDialog.openDialog());
    await act(() => result.current.importDialog.pickFile(garbage));

    expect(result.current.importDialog.report?.errors.length).toBeGreaterThan(0);
    expect(fetchSpy.mock.calls.length).toBe(callsBefore);
  });

  it('canCommit rămâne fals până se scrie exact IMPORT', async () => {
    await loadedSession();
    const { result } = renderHook(() => useExcelTransfer());

    act(() => result.current.importDialog.openDialog());
    await act(() => result.current.importDialog.pickFile(exportedFile(fixtureState)));
    await waitFor(() => expect(result.current.importDialog.report).not.toBeNull());

    expect(result.current.importDialog.canCommit).toBe(false);
    act(() => result.current.importDialog.setConfirmText('IMPORT'));
    expect(result.current.importDialog.canCommit).toBe(true);
  });

  it('commit trimite state-ul revalidat și fraza de confirmare, apoi închide dialogul', async () => {
    await loadedSession();
    const { result } = renderHook(() => useExcelTransfer());

    act(() => result.current.importDialog.openDialog());
    await act(() => result.current.importDialog.pickFile(exportedFile(fixtureState)));
    await waitFor(() => expect(result.current.importDialog.report).not.toBeNull());
    act(() => result.current.importDialog.setConfirmText('IMPORT'));

    await act(() => result.current.importDialog.commit());
    expect(result.current.importDialog.open).toBe(false);
  });

  it('exportAll declanșează XLSX.writeFile cu numele așteptat', async () => {
    await loadedSession();
    const { result } = renderHook(() => useExcelTransfer());

    await act(() => result.current.exportAll());

    expect(writeFileMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/^Startica_complet_.*\.xlsx$/),
      { compression: true },
    );
  });
});
