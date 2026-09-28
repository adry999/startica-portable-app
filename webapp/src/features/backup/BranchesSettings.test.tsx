import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@shared/ui';
import { BranchesSettings } from './BranchesSettings';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const buiucani = {
  id: 'BR-1',
  name: 'Filiala Buiucani',
  color: 'orange',
  address: 'str. Exemplu 12, Chișinău',
  createdAt: '2026-01-01T00:00:00.000Z',
  folder: null,
  children: 99,
  groups: 3,
  lastLocal: '2026-09-27T12:06:00.000Z',
};
const botanica = {
  id: 'BR-2',
  name: 'Filiala Botanica',
  color: 'mint',
  address: 'bd. Exemplu 5, Chișinău',
  createdAt: '2026-02-01T00:00:00.000Z',
  folder: 'botanica',
  children: 42,
  groups: 2,
  lastLocal: '2026-09-27T09:00:00.000Z',
};

function renderComponent() {
  return render(
    <ToastProvider>
      <BranchesSettings />
    </ToastProvider>,
  );
}

describe('BranchesSettings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lista arată filiala deschisă cu badge și contoarele fiecărei filiale', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/branches' && init?.method !== 'POST')
          return jsonResponse({ activeBranchId: 'BR-1', branches: [buiucani, botanica] });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderComponent();

    expect(await screen.findByText('Filiala Buiucani')).toBeInTheDocument();
    expect(screen.getByText('Deschisă acum')).toBeInTheDocument();
    expect(screen.getByText(/99 copii · 3 grupe · salvat/)).toBeInTheDocument();
    expect(screen.getByText(/42 copii · 2 grupe · salvat/)).toBeInTheDocument();
    expect(screen.queryByText('Șterge')).not.toBeInTheDocument();
  });

  it('nu există buton de ștergere', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/branches') return jsonResponse({ activeBranchId: 'BR-1', branches: [buiucani] });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderComponent();
    await screen.findByText('Filiala Buiucani');

    expect(screen.queryByRole('button', { name: /șterge/i })).not.toBeInTheDocument();
  });

  it('redenumirea și culoarea trimit update și reîmprospătează lista', async () => {
    let branches = [buiucani, botanica];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/branches' && init?.method !== 'POST')
          return jsonResponse({ activeBranchId: 'BR-1', branches });
        if (path === '/api/branches/update' && init?.method === 'POST') {
          const body = JSON.parse(String(init.body ?? '{}'));
          branches = branches.map(branch => (branch.id === body.id ? { ...branch, ...body } : branch));
          return jsonResponse({ branch: branches.find(branch => branch.id === body.id) });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderComponent();
    const user = userEvent.setup();
    await screen.findByText('Filiala Botanica');

    const renameButtons = screen.getAllByRole('button', { name: 'Redenumește' });
    await user.click(renameButtons[1]);
    const input = screen.getByLabelText('Numele filialei Filiala Botanica');
    await user.clear(input);
    await user.type(input, 'Filiala Botanica Nouă');
    await user.click(screen.getByRole('button', { name: 'Salvează' }));

    expect(await screen.findByText('Filiala Botanica Nouă')).toBeInTheDocument();

    const colorButtons = screen.getAllByRole('button', { name: 'Culoare' });
    await user.click(colorButtons[1]);
    await user.click(screen.getByRole('radio', { name: 'pink' }));

    await vi.waitFor(() => expect(branches.find(branch => branch.id === 'BR-2')?.color).toBe('pink'));
  });

  it('adăugarea creează o filială goală și nu există buton de ștergere', async () => {
    let branches = [buiucani];
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
            address: body.address ?? '',
            createdAt: '2026-09-27T00:00:00.000Z',
            folder: 'ciocana',
            children: 0,
            groups: 0,
            lastLocal: '',
            ...body,
          };
          branches = [...branches, created];
          return jsonResponse({ branch: created });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderComponent();
    const user = userEvent.setup();
    await screen.findByText('Filiala Buiucani');

    await user.click(screen.getByRole('button', { name: '+ Adaugă filială' }));
    await user.type(screen.getByLabelText('Nume'), 'Ciocana');
    await user.click(screen.getByRole('button', { name: 'Creează filiala' }));

    expect(await screen.findByText('Filiala Ciocana a fost creată. O deschizi din selector.')).toBeInTheDocument();
    expect(await screen.findByText('0 copii · 0 grupe · salvat niciodată')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /șterge/i })).not.toBeInTheDocument();
  });

  it('eșecul încărcării arată eroarea cu „Încearcă din nou”, nu rămâne blocat pe LoadingState (M6)', async () => {
    let attempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/branches' && init?.method !== 'POST') {
          attempts += 1;
          if (attempts === 1) throw new Error('Conexiune întreruptă.');
          return jsonResponse({ activeBranchId: 'BR-1', branches: [buiucani, botanica] });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderComponent();

    expect(await screen.findByRole('button', { name: 'Încearcă din nou' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Încearcă din nou' }));
    expect(await screen.findByText('Filiala Buiucani')).toBeInTheDocument();
  });
});
