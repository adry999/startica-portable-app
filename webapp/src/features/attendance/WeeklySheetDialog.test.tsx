import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { WeeklySheetDialog } from './WeeklySheetDialog';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = {
  children: [{ id: 'c1', name: 'Ana Popescu', parent: '', phone: '', groupId: 'g1', status: 'Activ' }],
  payments: [],
  expenses: [],
  groups: [{ id: 'g1', name: 'Fluturași', capacity: 10 }],
  categories: [],
  visits: [],
};

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
      if (path === '/api/state')
        return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
      if (path === '/api/health') return jsonResponse({});
      if (path === '/api/personal/state') return jsonResponse({ departments: [], roles: [], staff: [] });
      if (path === '/api/kindergarten') return jsonResponse({});
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

async function renderDialog() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
  render(
    <MemoryRouter>
      <WeeklySheetDialog onClose={vi.fn()} />
    </MemoryRouter>,
  );
  await screen.findByText('Foi de prezență pe săptămână');
}

describe('WeeklySheetDialog · indiciul „Copiii din grupa de azi” (Audit-B #4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('apare doar când săptămâna selectată nu e săptămâna curentă', async () => {
    stubFetch();
    await renderDialog();

    expect(screen.queryByText('Copiii din grupa de azi')).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Săptămâna anterioară' }));

    // Apare de două ori: în antetul dialogului și în previzualizarea foii (ambele randează indiciul).
    expect(screen.getAllByText('Copiii din grupa de azi').length).toBeGreaterThan(0);
  });
});
