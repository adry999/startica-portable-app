import { act, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { StickerPrintPage } from './StickerPrintPage';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const children = [
  {
    id: 'c1',
    name: 'Avram Maria',
    parent: '',
    phone: '',
    groupId: 'g1',
    status: 'Activ' as const,
    statusHistory: [],
    fee: null,
    feeHistory: [],
    dueDay: 1,
    archived: false,
  },
  {
    id: 'c2',
    name: 'Bivol Eva',
    parent: '',
    phone: '',
    groupId: 'g1',
    status: 'Activ' as const,
    statusHistory: [],
    fee: null,
    feeHistory: [],
    dueDay: 1,
    archived: false,
  },
  {
    id: 'c3',
    name: 'Coceva Alisa',
    parent: '',
    phone: '',
    groupId: 'g1',
    status: 'Activ' as const,
    statusHistory: [],
    fee: null,
    feeHistory: [],
    dueDay: 1,
    archived: true,
  },
  {
    id: 'c4',
    name: 'Lungu Matei',
    parent: '',
    phone: '',
    groupId: 'g2',
    status: 'Activ' as const,
    statusHistory: [],
    fee: null,
    feeHistory: [],
    dueDay: 1,
    archived: false,
  },
];

const state = {
  children,
  payments: [],
  expenses: [],
  groups: [
    { id: 'g1', name: 'Mars' },
    { id: 'g2', name: 'Soare' },
  ],
  categories: [],
  visits: [],
};

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '2.0.0' });
      if (path === '/api/state') return jsonResponse({ state, revision: 1, updatedAt: '2026-09-24T10:00:00Z' });
      if (path === '/api/health') return jsonResponse({});
      throw new Error(`neașteptat: ${path}`);
    }),
  );
  await act(() => session.result.current.load());
}

function renderStickers(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/tiparire/stickere${search}`]}>
      <Routes>
        <Route path="/tiparire/stickere" element={<StickerPrintPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('StickerPrintPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('precompletează modelul „Nume copil" și schimbă textul la alt model', async () => {
    await loadedSession();
    renderStickers();

    expect(screen.getByDisplayValue('Avram Maria')).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: 'Alergie' }).click();
    });

    expect(screen.getByDisplayValue('Fără arahide')).toBeInTheDocument();
  });

  it('tipărește câte o etichetă „Nume copil" pentru fiecare copil activ al grupei din ?grupa=', async () => {
    await loadedSession();
    const { container } = renderStickers('?grupa=g1');

    expect(await screen.findByText('Stickere pentru grupa Mars')).toBeInTheDocument();
    expect(screen.getByText('2 copii activi în grupă.')).toBeInTheDocument();

    const labels = container.querySelectorAll('[data-testid="sticker-label"]');
    // 1 în previzualizare + 2 în foaia de tipar (Avram Maria, Bivol Eva — fără Coceva Alisa, arhivată).
    expect(labels.length).toBe(3);
    expect(screen.getAllByText('Avram Maria').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bivol Eva').length).toBeGreaterThan(0);
    expect(screen.queryByText('Coceva Alisa')).not.toBeInTheDocument();
  });
});
