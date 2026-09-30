import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ChildAttendanceSection } from './ChildAttendanceSection';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = {
  children: [{ id: 'c1', name: 'Ana Popescu', parent: '', phone: '', groupId: null, status: 'Activ' }],
  payments: [],
  expenses: [],
  groups: [],
  categories: [],
  visits: [],
};

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('ChildAttendanceSection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arată punctele lunii și absențele motivate cu motivul', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path.startsWith('/api/attendance'))
          return jsonResponse({
            entries: [
              { childId: 'c1', date: '2026-09-01', status: 'present', reason: '', updatedAt: '' },
              { childId: 'c1', date: '2026-09-02', status: 'excused', reason: 'Boală', updatedAt: '' },
            ],
          });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    await loadedSession();
    render(<ChildAttendanceSection childId="c1" month="2026-09" />);

    await screen.findByText('Prezența');
    expect(await screen.findByText(/Boală/)).toBeInTheDocument();
  });

  it('fără marcaje arată linia goală și mesajul', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path.startsWith('/api/attendance')) return jsonResponse({ entries: [] });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    await loadedSession();
    render(<ChildAttendanceSection childId="c1" month="2026-09" />);

    expect(await screen.findByText('Nicio absență motivată în septembrie 2026.')).toBeInTheDocument();
  });
});
