import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@shared/ui';
import { KindergartenSettings } from './KindergartenSettings';
import type { KindergartenSettings as KindergartenSettingsData } from './useKindergarten';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const emptySettings: KindergartenSettingsData = {
  name: '',
  displayName: '',
  idno: '',
  administrator: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  iban: '',
  bank: '',
  nextReceiptNumber: 1,
  receiptFormat: 'a5',
  signatureLabel: '',
  footerNote: '',
  logoDataUrl: '',
};

function renderComponent() {
  return render(
    <ToastProvider>
      <KindergartenSettings />
    </ToastProvider>,
  );
}

describe('KindergartenSettings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arată datele salvate în câmpurile de identitate și contact', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        const isPost = init?.method === 'POST';
        if (path === '/api/kindergarten' && !isPost)
          return jsonResponse({ ...emptySettings, name: 'Grădinița Curcubeu', idno: '1000600000000' });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderComponent();

    expect(await screen.findByDisplayValue('Grădinița Curcubeu')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1000600000000')).toBeInTheDocument();
  });

  it('editarea și salvarea trimit obiectul complet și arată un toast', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        const isPost = init?.method === 'POST';
        if (path === '/api/kindergarten' && !isPost) return jsonResponse(emptySettings);
        if (path === '/api/kindergarten' && isPost) {
          const body = JSON.parse(String(init?.body ?? '{}'));
          return jsonResponse({ ...emptySettings, ...body });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderComponent();
    const user = userEvent.setup();

    const nameInput = await screen.findByLabelText('Denumire');
    await user.type(nameInput, 'Grădinița Soarele');
    await user.click(screen.getByText('Salvează datele'));

    expect(await screen.findByText('Datele grădiniței au fost salvate.')).toBeInTheDocument();
    expect(screen.getByText('Grădinița Soarele')).toBeInTheDocument();
  });

  it('„Renunță” revine la ultimele date salvate, fără să trimită cererea', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        const isPost = init?.method === 'POST';
        if (path === '/api/kindergarten' && !isPost) return jsonResponse({ ...emptySettings, name: 'Grădinița A' });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderComponent();
    const user = userEvent.setup();

    const nameInput = await screen.findByLabelText('Denumire');
    await user.clear(nameInput);
    await user.type(nameInput, 'Alt nume');
    expect(screen.getByLabelText('Denumire')).toHaveValue('Alt nume');

    await user.click(screen.getByText('Renunță'));
    expect(screen.getByLabelText('Denumire')).toHaveValue('Grădinița A');
  });

  it('permite schimbarea formatului confirmării de plată', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        const isPost = init?.method === 'POST';
        if (path === '/api/kindergarten' && !isPost) return jsonResponse(emptySettings);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderComponent();
    const user = userEvent.setup();

    await screen.findByLabelText('Denumire');
    const a4Option = screen.getByRole('radio', { name: 'A4 · 1/3 + 2/3' });
    expect(a4Option).toHaveAttribute('aria-checked', 'false');

    await user.click(a4Option);
    expect(a4Option).toHaveAttribute('aria-checked', 'true');
  });
});
