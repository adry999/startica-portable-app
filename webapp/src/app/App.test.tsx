import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { ToastProvider } from '@shared/ui';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const emptyState = { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] };

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: emptyState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  it('pornește pe Dashboard, în interiorul shell-ului', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </MemoryRouter>,
    );
    // Shell-ul (sidebar, antet) apare abia după ce sesiunea are snapshot-ul — vezi StartupScreen (21a).
    expect(await screen.findByRole('heading', { name: 'Rezumatul lunii' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dashboard/ })).toHaveAttribute('aria-current', 'page');
  });

  it('navigarea din sidebar schimbă conținutul', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Vizite' }));
    expect(screen.getByRole('heading', { name: 'Vizite' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Programează vizită' })).toBeInTheDocument();
  });

  it('/copii/zile-de-nastere e ecranul Zile de naștere, nu fișa unui copil cu acest id', async () => {
    render(
      <MemoryRouter initialEntries={['/copii/zile-de-nastere']}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Zile de naștere' })).toBeInTheDocument();
    expect(screen.queryByText('Fișa nu a putut fi găsită.')).not.toBeInTheDocument();
  });

  it('o cale necunoscută revine la Dashboard', async () => {
    render(
      <MemoryRouter initialEntries={['/ceva-inexistent']}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Rezumatul lunii' })).toBeInTheDocument();
  });
});
