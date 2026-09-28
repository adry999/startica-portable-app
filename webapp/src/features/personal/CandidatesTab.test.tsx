import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { CandidatesTab } from './CandidatesTab';
import type { Candidate } from '@shared/personal/personal.types';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

let candidates: Candidate[] = [];

function stubFetch() {
  candidates = [
    {
      id: 'CAN-1',
      name: 'Bianca Robu',
      position: 'Educator',
      age: 27,
      experience: '3 ani',
      city: 'Chișinău',
      phone: '069000111',
      notes: 'Disponibilă din octombrie',
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 'CAN-2',
      name: 'Andrei Musteață',
      position: 'Bucătar',
      age: null,
      experience: '',
      city: '',
      phone: '069000222',
      notes: '',
      createdAt: '2026-09-02T10:00:00.000Z',
      updatedAt: '2026-09-02T10:00:00.000Z',
    },
  ];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3', branch: null, branches: [] });
      if (path === '/api/state')
        return jsonResponse({
          state: { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] },
          revision: 1,
          updatedAt: '2026-09-23T10:00:00Z',
        });
      if (path === '/api/health') return jsonResponse({});
      if (path === '/api/personal/candidates' && (!init || init.method === undefined))
        return jsonResponse({ candidates });
      if (path === '/api/personal/candidates' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { mode: 'create' | 'update'; candidate: Candidate };
        if (body.mode === 'create') candidates = [...candidates, body.candidate];
        else candidates = candidates.map(c => (c.id === body.candidate.id ? body.candidate : c));
        return jsonResponse({ candidate: body.candidate });
      }
      if (path === '/api/personal/candidates-delete') {
        const body = JSON.parse(String(init?.body)) as { id: string };
        candidates = candidates.filter(c => c.id !== body.id);
        return jsonResponse({ ok: true });
      }
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

function renderTab() {
  function Wrapper() {
    return <CandidatesTab formTarget={null} onNew={() => {}} onOpenRow={() => {}} onCloseForm={() => {}} />;
  }
  return render(
    <ToastProvider>
      <Wrapper />
    </ToastProvider>,
  );
}

describe('CandidatesTab', () => {
  beforeEach(() => stubFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('arată lista de candidați și caută după telefon și notițe', async () => {
    await loadedSession();
    renderTab();

    await screen.findByText('Bianca Robu');
    expect(screen.getByText('Andrei Musteață')).toBeInTheDocument();
    expect(screen.getByText('2 persoane')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Caută candidat'), '069000222');
    expect(await screen.findByText('1 din 2')).toBeInTheDocument();
    expect(screen.queryByText('Bianca Robu')).not.toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText('Caută candidat'));
    await user.type(screen.getByPlaceholderText('Caută candidat'), 'octombrie');
    expect(await screen.findByText('1 din 2')).toBeInTheDocument();
    expect(screen.getByText('Bianca Robu')).toBeInTheDocument();
  });

  it('lista goală arată EmptyState „Niciun candidat încă”', async () => {
    candidates = [];
    await loadedSession();
    renderTab();

    expect(await screen.findByText('Niciun candidat încă')).toBeInTheDocument();
  });
});

describe('CandidateFormDrawer', () => {
  beforeEach(() => stubFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('adaugă un candidat nou din formular', async () => {
    await loadedSession();

    function Harness() {
      return <CandidatesTab formTarget="new" onNew={() => {}} onOpenRow={() => {}} onCloseForm={() => {}} />;
    }
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );

    const user = userEvent.setup();
    await screen.findByText('Adaugă: candidat');
    await user.type(screen.getByLabelText('Nume, prenume'), 'Cristina Ionescu');
    await user.click(screen.getByRole('button', { name: 'Salvează' }));

    expect(await screen.findByText('Candidatul a fost salvat.')).toBeInTheDocument();
  });

  it('editează și șterge un candidat existent, cu confirmarea „Scrie ȘTERGE”', async () => {
    await loadedSession();

    function Harness() {
      return <CandidatesTab formTarget={candidates[0]} onNew={() => {}} onOpenRow={() => {}} onCloseForm={() => {}} />;
    }
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );

    const user = userEvent.setup();
    await screen.findByText('Editează: candidat');
    await user.click(screen.getByRole('button', { name: 'Șterge' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Ștergi candidatul?' });
    await user.type(within(dialog).getByLabelText('Scrie ȘTERGE pentru confirmare'), 'ȘTERGE');
    await user.click(within(dialog).getByRole('button', { name: 'Șterge definitiv' }));

    expect(await screen.findByText('Candidatul a fost șters.')).toBeInTheDocument();
  });
});
