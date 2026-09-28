import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestJsonMock = vi.fn();
let sessionState: {
  sync:
    | { configured: true; deviceName: string; serverUrl: string; connection?: string }
    | { configured: false; suggestedName: string }
    | null;
};

vi.mock('@shared/api/session', () => ({
  useAppSession: () => ({ state: sessionState }),
  requestJson: (...args: unknown[]) => requestJsonMock(...args),
}));

describe('useSyncSettings', () => {
  beforeEach(() => {
    requestJsonMock.mockReset();
  });

  it('neconfigurat: nu cere nimic serverului, expune numele sugerat', async () => {
    sessionState = { sync: { configured: false, suggestedName: 'Calculator-Recepție' } };
    const { useSyncSettings } = await import('./useSyncSettings');
    const { result } = renderHook(() => useSyncSettings());

    expect(result.current.configured).toBe(false);
    expect(result.current.suggestedName).toBe('Calculator-Recepție');
    expect(requestJsonMock).not.toHaveBeenCalled();
  });

  it('configurat: încarcă serverul și lista de calculatoare', async () => {
    sessionState = { sync: { configured: true, deviceName: 'Calculator A', serverUrl: 'https://sync.exemplu.md' } };
    requestJsonMock.mockImplementation((path: string) => {
      if (path === '/api/sync/server')
        return Promise.resolve({ branches: 2, devices: 3, lastBackupAt: '2026-09-28T01:00:00Z' });
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
      throw new Error(`neașteptat: ${path}`);
    });

    const { useSyncSettings } = await import('./useSyncSettings');
    const { result } = renderHook(() => useSyncSettings());

    await waitFor(() => expect(result.current.devicesReady).toBe(true));
    expect(result.current.server?.branches).toBe(2);
    expect(result.current.devices).toHaveLength(1);
  });

  it('revokeDevice trimite deviceId și reîncarcă lista', async () => {
    sessionState = { sync: { configured: true, deviceName: 'Calculator A', serverUrl: 'https://sync.exemplu.md' } };
    let devices = [
      { id: 'd1', name: 'A', os: 'Windows', lastSeenAt: '', lastBranchId: null, revokedAt: null, me: true },
    ];
    requestJsonMock.mockImplementation((path: string, body?: unknown) => {
      if (path === '/api/sync/server') return Promise.resolve({ branches: 1, devices: 1, lastBackupAt: '' });
      if (path === '/api/sync/devices') return Promise.resolve({ devices });
      if (path === '/api/sync/devices/revoke') {
        expect(body).toEqual({ deviceId: 'd1' });
        devices = [];
        return Promise.resolve({ ok: true });
      }
      throw new Error(`neașteptat: ${path}`);
    });

    const { useSyncSettings } = await import('./useSyncSettings');
    const { result } = renderHook(() => useSyncSettings());
    await waitFor(() => expect(result.current.devicesReady).toBe(true));

    await act(async () => {
      await result.current.revokeDevice('d1');
    });

    expect(result.current.devices).toHaveLength(0);
  });

  it('connect trimite exact contractul Task 11', async () => {
    sessionState = { sync: { configured: false, suggestedName: 'Calculator nou' } };
    requestJsonMock.mockResolvedValue({ uploaded: ['Filiala principală'], downloaded: [] });

    const { useSyncSettings } = await import('./useSyncSettings');
    const { result } = renderHook(() => useSyncSettings());

    let outcome;
    await act(async () => {
      outcome = await result.current.connect({
        serverUrl: 'https://sync.exemplu.md',
        code: '123456',
        deviceName: 'Calculator nou',
      });
    });

    expect(requestJsonMock).toHaveBeenCalledWith('/api/sync/connect', {
      serverUrl: 'https://sync.exemplu.md',
      code: '123456',
      deviceName: 'Calculator nou',
    });
    expect(outcome).toEqual({ uploaded: ['Filiala principală'], downloaded: [] });
  });
});
