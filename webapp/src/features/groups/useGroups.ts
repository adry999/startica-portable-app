import { useState } from 'react';
import { useAppSession } from '@shared/api/session';
import { formatAge } from '#shared/format/date-format.mjs';
import type { Child, Group, RecordsSnapshot } from '@contracts/record-types.mjs';

export type GroupsStatus = 'loading' | 'ready' | 'failed';

export interface GroupMemberView {
  id: string;
  name: string;
  ageLabel: string;
}

export interface GroupCardView {
  id: string;
  name: string;
  educator: string;
  capacity: number | null;
  memberCount: number;
  occupancyLabel: string;
  occupancyPercent: number;
  overCapacity: boolean;
  ageRangeLabel: string;
  avatarInitials: string[];
  extraMemberCount: number;
  members: GroupMemberView[];
}

export interface UnassignedChild {
  id: string;
  name: string;
  ageLabel: string;
}

export interface GroupsData {
  status: GroupsStatus;
  failureMessage: string;
  groups: GroupCardView[];
  unassignedChildren: UnassignedChild[];
  openGroupId: string | null;
  toggleGroup: (id: string) => void;
  createGroup: (name: string, capacityRaw: string) => Promise<void>;
  updateGroup: (id: string, name: string, capacityRaw: string, educator: string) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  assignChild: (groupId: string, childId: string) => Promise<void>;
  removeChild: (childId: string) => Promise<void>;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');
}

function parseCapacity(capacityRaw: string): number | null {
  const trimmed = capacityRaw.trim();
  return trimmed ? Number(trimmed) : null;
}

function buildGroupCard(group: Group, activeChildren: Child[]): GroupCardView {
  const members = activeChildren
    .filter(child => child.groupId === group.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  const memberCount = members.length;
  const overCapacity = group.capacity != null && memberCount > group.capacity;
  const occupancyLabel = `${memberCount}/${group.capacity ?? '—'}`;
  const occupancyPercent = group.capacity ? Math.min(100, (memberCount / group.capacity) * 100) : 0;
  const birthDates = members
    .map(child => child.birthDate)
    .filter((date): date is string => Boolean(date))
    .sort();
  const ageRangeLabel =
    birthDates.length === 0
      ? '—'
      : birthDates[0] === birthDates.at(-1)
        ? formatAge(birthDates[0])
        : `${formatAge(birthDates.at(-1) as string)} – ${formatAge(birthDates[0])}`;

  return {
    id: group.id,
    name: group.name,
    educator: group.educator ?? '',
    capacity: group.capacity,
    memberCount,
    occupancyLabel,
    occupancyPercent,
    overCapacity,
    ageRangeLabel,
    avatarInitials: members.slice(0, 5).map(child => initials(child.name)),
    extraMemberCount: Math.max(0, memberCount - 5),
    members: members.map(child => ({ id: child.id, name: child.name, ageLabel: formatAge(child.birthDate) })),
  };
}

/**
 * Echivalentul useDashboard pentru ecranul Grupe: date derivate din sesiune +
 * mutațiile de orchestrare (create/update/delete/assign/remove), la fel cum
 * groups.controller.mjs le orchestra în vanilla. openGroupId trăiește aici,
 * nu în fiecare card, ca un singur editor să fie deschis o dată.
 */
export function useGroups(): GroupsData {
  const session = useAppSession();
  const { state, ready, loading, saveError } = session.state;
  const records = state as RecordsSnapshot;
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  function toggleGroup(id: string) {
    setOpenGroupId(current => (current === id ? null : id));
  }

  async function createGroup(name: string, capacityRaw: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Completează numele grupei.');
    await session.mutate('/api/record', {
      type: 'groups',
      mode: 'create',
      record: { id: `GRP-${crypto.randomUUID()}`, name: trimmed, capacity: parseCapacity(capacityRaw) },
    });
  }

  async function updateGroup(id: string, name: string, capacityRaw: string, educator: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Numele grupei nu poate fi gol.');
    const group = records.groups.find(g => g.id === id);
    await session.mutate('/api/record', {
      type: 'groups',
      mode: 'update',
      record: { ...group, name: trimmed, capacity: parseCapacity(capacityRaw), educator: educator.trim() },
    });
  }

  async function deleteGroup(id: string) {
    await session.mutate('/api/group-delete', { id });
    setOpenGroupId(current => (current === id ? null : current));
  }

  async function assignChild(groupId: string, childId: string) {
    const child = records.children.find(c => c.id === childId);
    await session.mutate('/api/record', { type: 'children', mode: 'update', record: { ...child, groupId } });
  }

  async function removeChild(childId: string) {
    const child = records.children.find(c => c.id === childId);
    await session.mutate('/api/record', { type: 'children', mode: 'update', record: { ...child, groupId: null } });
  }

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      groups: [],
      unassignedChildren: [],
      openGroupId,
      toggleGroup,
      createGroup,
      updateGroup,
      deleteGroup,
      assignChild,
      removeChild,
    };
  }

  const activeChildren = records.children.filter(child => !child.archived);
  const groups = [...records.groups]
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
    .map(group => buildGroupCard(group, activeChildren));
  const unassignedChildren = activeChildren
    .filter(child => !child.groupId)
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
    .map(child => ({ id: child.id, name: child.name, ageLabel: formatAge(child.birthDate) }));

  return {
    status: 'ready',
    failureMessage: '',
    groups,
    unassignedChildren,
    openGroupId,
    toggleGroup,
    createGroup,
    updateGroup,
    deleteGroup,
    assignChild,
    removeChild,
  };
}
