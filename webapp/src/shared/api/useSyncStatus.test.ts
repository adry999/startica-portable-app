import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requestJsonMock = vi.fn();
const reloadRecordsMock = vi.fn();
let sessionState: { revision: number; sync: { configured: boolean } | null };

vi.mock('@shared/api/session', () => ({
  useAppSession: () => ({ state: sessionState }),
  requestJson: (...args: unknown[]) => requestJsonMock(...args),
  reloadRecords: () => reloadRecordsMock(),
}));

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners: Record<string, ((event: { data: string }) => void)[]> = {};
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, callback: (event: { data: string }) => void) {
    (this.listeners[type] ??= []).push(callback);
  }
  emit(type: string, data: unknown) {
    for (const callback of this.listeners[type] ?? []) callback({ data: JSON.stringify(data) });
  }
  close() {
    this.closed = true;
  }
}

const STATUS_RESPONSE = {
  configured: true,
  serverUrl: 'https://sync.exemplu.md',
  deviceName: 'Calculator A',
  connection: 'online' as const,
  pending: 0,
  pushing: false,
  lastSyncedAt: '',
  conflicts: 0,
  lastError: '',
};

describe('useSyncStatus', () => {
  beforeEach(async () => {
    const module = await import('./useSyncStatus');
    module.__resetSyncStatusForTests();
    requestJsonMock.mockReset().mockResolvedValue(STATUS_RESPONSE);
    reloadRecordsMock.mockReset();
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
    sessionState = { revision: 5, sync: { configured: true } };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('nu pornește niciun flux SSE cât sincronizarea nu e configurată', async () => {
    sessionState = { revision: 5, sync: null };
    const { useSyncStatus } = await import('./useSyncStatus');
    renderHook(() => useSyncStatus());
    await act(async () => {
      await Promise.resolve();
    });
    expect(FakeEventSource.instances).toHaveLength(0);
    expect(requestJsonMock).not.toHaveBeenCalled();
  });

  it('records-changed cu altă revizie reîncarcă datele o singură dată', async () => {
    vi.useFakeTimers();
    const { useSyncStatus } = await import('./useSyncStatus');
    renderHook(() => useSyncStatus());
    await act(async () => {
      await Promise.resolve();
    });

    const source = FakeEventSource.instances[0];
    expect(source).toBeDefined();

    act(() => {
      source.emit('records-changed', { revision: 6 });
      source.emit('records-changed', { revision: 6 });
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(reloadRecordsMock).toHaveBeenCalledTimes(1);
  });

  it('records-changed cu aceeași revizie nu reîncarcă nimic', async () => {
    vi.useFakeTimers();
    const { useSyncStatus } = await import('./useSyncStatus');
    renderHook(() => useSyncStatus());
    await act(async () => {
      await Promise.resolve();
    });

    const source = FakeEventSource.instances[0];
    act(() => {
      source.emit('records-changed', { revision: 5 });
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(reloadRecordsMock).not.toHaveBeenCalled();
  });

  it('evenimentul status actualizează starea întoarsă de hook', async () => {
    const { useSyncStatus } = await import('./useSyncStatus');
    const { result } = renderHook(() => useSyncStatus());
    await act(async () => {
      await Promise.resolve();
    });

    const source = FakeEventSource.instances[0];
    act(() => {
      source.emit('status', { ...STATUS_RESPONSE, connection: 'offline', pending: 3 });
    });

    expect(result.current.connection).toBe('offline');
    expect(result.current.pending).toBe(3);
  });

  it('decuplarea (configured → false) închide fluxul SSE, nu-l lasă deschis pe fundal', async () => {
    const { useSyncStatus } = await import('./useSyncStatus');
    const { rerender } = renderHook(() => useSyncStatus());
    await act(async () => {
      await Promise.resolve();
    });

    const source = FakeEventSource.instances[0];
    expect(source.closed).toBe(false);

    sessionState = { revision: 5, sync: null };
    rerender();

    expect(source.closed).toBe(true);
  });

  it('polling-ul de rezervă se oprește la decuplare, nu mai cere status după aceea', async () => {
    vi.useFakeTimers();
    const { useSyncStatus } = await import('./useSyncStatus');
    const { rerender } = renderHook(() => useSyncStatus());
    await act(async () => {
      await Promise.resolve();
    });

    const source = FakeEventSource.instances[0];
    act(() => {
      source.onerror?.();
    });
    requestJsonMock.mockClear();

    sessionState = { revision: 5, sync: null };
    rerender();

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(requestJsonMock).not.toHaveBeenCalled();
  });
});
