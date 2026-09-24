import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { ChildrenCsvDialog } from './ChildrenCsvDialog';

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

function renderDialog(open: boolean, onClose: () => void) {
  return render(
    <ToastProvider>
      <ChildrenCsvDialog open={open} onClose={onClose} />
    </ToastProvider>,
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('ChildrenCsvDialog', () => {
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
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('previzualizează fișierul ales și importă după scrierea frazei de confirmare', async () => {
    await loadedSession();
    renderDialog(true, () => {});
    const user = userEvent.setup();

    const file = new File(['Nr. contract,Nume\n10,Radu Ionescu\n'], 'copii.csv', { type: 'text/csv' });
    const input = screen.getByLabelText('Fișier CSV') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => expect(screen.getByText(/1 adăugări/)).toBeInTheDocument());

    const commitButton = screen.getByRole('button', { name: 'Confirmă importul' });
    expect(commitButton).toBeDisabled();

    await user.type(screen.getByLabelText('Scrie IMPORT COPII pentru a confirma'), 'IMPORT COPII');
    expect(commitButton).not.toBeDisabled();

    await user.click(commitButton);
    expect(await screen.findByText(/copii importați/)).toBeInTheDocument();
  });
});
