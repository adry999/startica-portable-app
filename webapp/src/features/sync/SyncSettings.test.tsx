import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@shared/ui';

const requestJsonMock = vi.fn();
let sessionState: {
  branches: { id: string; name: string }[];
  sync:
    | { configured: true; deviceName: string; serverUrl: string; connection?: string }
    | { configured: false; suggestedName: string }
    | null;
};

vi.mock('@shared/api/session', () => ({
  useAppSession: () => ({ state: sessionState }),
  requestJson: (...args: unknown[]) => requestJsonMock(...args),
  reloadRecords: () => {},
}));

class FakeEventSource {
  onerror: (() => void) | null = null;
  addEventListener() {}
  close() {}
  constructor(public url: string) {}
}

function renderPage() {
  return import('./SyncSettings').then(({ SyncSettings }) =>
    render(
      <ToastProvider>
        <SyncSettings />
      </ToastProvider>,
    ),
  );
}

describe('SyncSettings', () => {
  beforeEach(() => {
    requestJsonMock.mockReset();
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
    vi.stubGlobal('location', { ...window.location, reload: vi.fn() });
  });

  it('fără sync.json apare formularul de conectare cu cod sau cheie', async () => {
    sessionState = { branches: [], sync: { configured: false, suggestedName: 'Recepție' } };
    await renderPage();

    expect(screen.getByText('Conectează acest calculator la server')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('123456')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Primul calculator' }));
    expect(screen.getByText('Cheia de instalare')).toBeInTheDocument();
  });

  it('cardul serverului arată starea, contoarele și ultima copie de siguranță', async () => {
    sessionState = {
      branches: [],
      sync: {
        configured: true,
        deviceName: 'Calculator A',
        serverUrl: 'https://sync.exemplu.md',
        connection: 'online',
      },
    };
    requestJsonMock.mockImplementation((path: string) => {
      if (path === '/api/sync/status')
        return Promise.resolve({
          configured: true,
          serverUrl: 'https://sync.exemplu.md',
          deviceName: 'Calculator A',
          connection: 'online',
          pending: 0,
          pushing: false,
          lastSyncedAt: '2026-09-28T12:06:00.000Z',
          conflicts: 0,
          lastError: '',
        });
      if (path === '/api/sync/server')
        return Promise.resolve({ branches: 2, devices: 3, lastBackupAt: '2026-09-28T01:00:00.000Z' });
      if (path === '/api/sync/devices')
        return Promise.resolve({
          devices: [
            {
              id: 'd1',
              name: 'Calculator A',
              os: 'Windows',
              lastSeenAt: '',
              lastBranchId: null,
              revokedAt: null,
              me: true,
            },
          ],
        });
      return Promise.reject(new Error(`neașteptat: ${path}`));
    });

    await renderPage();

    await waitFor(() => expect(screen.getByText(/2 filiale/)).toBeInTheDocument());
    expect(screen.getByText(/3 calculatoare/)).toBeInTheDocument();
    expect(screen.getByText(/ultima copie de siguranță pe server/)).toBeInTheDocument();
  });

  it('Deconectează lipsește pe rândul Acest calculator și cere confirmare pe celelalte', async () => {
    sessionState = {
      branches: [],
      sync: {
        configured: true,
        deviceName: 'Calculator A',
        serverUrl: 'https://sync.exemplu.md',
        connection: 'online',
      },
    };
    requestJsonMock.mockImplementation((path: string) => {
      if (path === '/api/sync/status')
        return Promise.resolve({
          configured: true,
          serverUrl: '',
          deviceName: '',
          connection: 'online',
          pending: 0,
          pushing: false,
          lastSyncedAt: '',
          conflicts: 0,
          lastError: '',
        });
      if (path === '/api/sync/server') return Promise.resolve({ branches: 1, devices: 2, lastBackupAt: '' });
      if (path === '/api/sync/devices')
        return Promise.resolve({
          devices: [
            {
              id: 'd1',
              name: 'Acest calculator',
              os: 'Windows',
              lastSeenAt: '',
              lastBranchId: null,
              revokedAt: null,
              me: true,
            },
            {
              id: 'd2',
              name: 'Calculator birou',
              os: 'Windows',
              lastSeenAt: '',
              lastBranchId: null,
              revokedAt: null,
              me: false,
            },
          ],
        });
      return Promise.reject(new Error(`neașteptat: ${path}`));
    });

    await renderPage();
    await waitFor(() => expect(screen.getByText('Calculator birou')).toBeInTheDocument());

    const revokeButtons = screen.getAllByRole('button', { name: 'Deconectează' });
    expect(revokeButtons).toHaveLength(1);

    await userEvent.click(revokeButtons[0]);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('+ Conectează un calculator cere un cod și îl afișează cu adresa', async () => {
    sessionState = {
      branches: [],
      sync: {
        configured: true,
        deviceName: 'Calculator A',
        serverUrl: 'https://sync.exemplu.md',
        connection: 'online',
      },
    };
    requestJsonMock.mockImplementation((path: string) => {
      if (path === '/api/sync/status')
        return Promise.resolve({
          configured: true,
          serverUrl: '',
          deviceName: '',
          connection: 'online',
          pending: 0,
          pushing: false,
          lastSyncedAt: '',
          conflicts: 0,
          lastError: '',
        });
      if (path === '/api/sync/server') return Promise.resolve({ branches: 1, devices: 1, lastBackupAt: '' });
      if (path === '/api/sync/devices') return Promise.resolve({ devices: [] });
      if (path === '/api/sync/pairing-codes')
        return Promise.resolve({
          code: '482913',
          expiresAt: '2026-09-28T12:20:00.000Z',
          serverUrl: 'https://sync.exemplu.md',
        });
      return Promise.reject(new Error(`neașteptat: ${path}`));
    });

    await renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: '+ Conectează un calculator' })).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '+ Conectează un calculator' }));

    await waitFor(() => expect(screen.getByText('482913')).toBeInTheDocument());
    expect(screen.getByText('https://sync.exemplu.md')).toBeInTheDocument();
  });
});
