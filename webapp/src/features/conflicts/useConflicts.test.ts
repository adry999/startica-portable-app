import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConflicts } from './useConflicts';

const requestJsonMock = vi.fn();
const mutateMock = vi.fn();

vi.mock('@shared/api/session', () => ({
  useAppSession: () => ({ state: {}, mutate: mutateMock }),
  requestJson: (...args: unknown[]) => requestJsonMock(...args),
}));

const CONFLICTS = [
  {
    id: 'CFL-1',
    kind: 'children',
    recordId: 'CHILD-1',
    title: 'Ana Popescu',
    subtitle: '1 câmp diferit',
    localUpdatedAt: '2026-09-27T10:00:00.000Z',
    remoteUpdatedAt: '2026-09-27T11:00:00.000Z',
    remoteDeviceName: 'Calculator B',
    fields: [{ field: 'name', local: 'Ana', remote: 'Ana Popescu', differs: true }],
    dataset: 'branch' as const,
  },
  {
    id: 'CFL-2',
    kind: 'groups',
    recordId: 'GRP-1',
    title: 'Grupa Mari',
    subtitle: '1 câmp diferit',
    localUpdatedAt: '2026-09-27T09:00:00.000Z',
    remoteUpdatedAt: '2026-09-27T09:30:00.000Z',
    remoteDeviceName: 'Calculator B',
    fields: [{ field: 'capacity', local: 20, remote: 22, differs: true }],
    dataset: 'branch' as const,
  },
  {
    id: 'CFL-3',
    kind: 'staff',
    recordId: 'STF-1',
    title: 'Maria Ionescu',
    subtitle: '1 câmp diferit',
    localUpdatedAt: '2026-09-27T09:00:00.000Z',
    remoteUpdatedAt: '2026-09-27T09:30:00.000Z',
    remoteDeviceName: 'Calculator B',
    fields: [{ field: 'name', local: 'Maria I.', remote: 'Maria Ionescu', differs: true }],
    dataset: 'comun' as const,
  },
];

describe('useConflicts', () => {
  beforeEach(() => {
    requestJsonMock.mockReset().mockResolvedValue({ conflicts: CONFLICTS });
    mutateMock.mockReset().mockResolvedValue({});
  });

  it('încarcă lista și marchează primul conflict ca activ', async () => {
    const { result } = renderHook(() => useConflicts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.conflicts).toHaveLength(3);
    expect(result.current.activeId).toBe('CFL-1');
  });

  it('resolve trimite alegerea și reîncarcă lista', async () => {
    requestJsonMock
      .mockResolvedValueOnce({ conflicts: CONFLICTS })
      .mockResolvedValueOnce({ conflicts: [CONFLICTS[1]] });
    const { result } = renderHook(() => useConflicts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.resolve('CFL-1', 'remote');
    });

    expect(mutateMock).toHaveBeenCalledWith('/api/sync/conflicts/resolve', {
      id: 'CFL-1',
      choice: 'remote',
      dataset: 'branch',
    });
    expect(requestJsonMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.conflicts).toHaveLength(1));
  });

  it('resolve pentru un conflict „staff” trimite dataset: comun (Personal 24, decizia 9)', async () => {
    requestJsonMock
      .mockResolvedValueOnce({ conflicts: CONFLICTS })
      .mockResolvedValueOnce({ conflicts: [CONFLICTS[0], CONFLICTS[1]] });
    const { result } = renderHook(() => useConflicts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.resolve('CFL-3', 'local');
    });

    expect(mutateMock).toHaveBeenCalledWith('/api/sync/conflicts/resolve', {
      id: 'CFL-3',
      choice: 'local',
      dataset: 'comun',
    });
  });
});
