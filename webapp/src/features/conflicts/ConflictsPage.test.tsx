import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictsPage } from './ConflictsPage';

const resolveMock = vi.fn();
const setActiveIdMock = vi.fn();

let conflicts: unknown[];
let activeId: string | null;

vi.mock('@shared/api/session', () => ({
  useAppSession: () => ({ state: { state: { groups: [] } } }),
}));

vi.mock('./useConflicts', () => ({
  useConflicts: () => ({
    conflicts,
    loading: false,
    activeId,
    setActiveId: setActiveIdMock,
    resolve: resolveMock,
  }),
}));

const CFL_1 = {
  id: 'CFL-1',
  kind: 'children',
  recordId: 'CHILD-1',
  title: 'Ana Popescu',
  subtitle: '1 câmp diferit',
  localUpdatedAt: '2026-09-27T10:00:00.000Z',
  remoteUpdatedAt: '2026-09-27T11:00:00.000Z',
  remoteDeviceName: 'Calculator B',
  fields: [
    { field: 'name', local: 'Ana', remote: 'Ana Popescu', differs: true },
    { field: 'phone', local: '069123456', remote: '069123456', differs: false },
  ],
};

const CFL_2 = {
  id: 'CFL-2',
  kind: 'groups',
  recordId: 'GRP-1',
  title: 'Grupa Mari',
  subtitle: '1 câmp diferit',
  localUpdatedAt: '2026-09-27T09:00:00.000Z',
  remoteUpdatedAt: '2026-09-27T09:30:00.000Z',
  remoteDeviceName: 'Calculator B',
  fields: [{ field: 'capacity', local: 20, remote: 22, differs: true }],
};

describe('ConflictsPage', () => {
  beforeEach(() => {
    resolveMock.mockReset().mockResolvedValue(undefined);
    setActiveIdMock.mockReset();
    conflicts = [CFL_1, CFL_2];
    activeId = 'CFL-1';
  });

  it('lista și detaliul arată ambele variante cu rândurile diferite evidențiate', () => {
    render(<ConflictsPage />);
    expect(screen.getByText('2 conflicte')).toBeInTheDocument();
    expect(screen.getAllByText('Ana Popescu').length).toBeGreaterThan(0);
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getAllByText('069123456')).toHaveLength(2);
    expect(screen.getByText('Rândurile galbene diferă. Celelalte câmpuri sunt identice.')).toBeInTheDocument();
  });

  it('alegerea unei variante trimite resolve pentru conflictul activ', () => {
    render(<ConflictsPage />);
    fireEvent.click(screen.getByText('Păstrează varianta de pe Calculator B'));
    expect(resolveMock).toHaveBeenCalledWith('CFL-1', 'remote');
  });
});
