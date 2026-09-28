import { useMemo, useState } from 'react';
import { useAppSession } from '@shared/api/session';
import { formatAge, ageInYears } from '#shared/format/date-format.mjs';
import { initials } from '@shared/format/initials';
import { sortByGroupOrder } from '@shared/format/group-order';
import { boardTone, type BoardTone } from './groupBoardTone';
import type { Child, Group, GroupTeamMember, RecordsSnapshot } from '@contracts/record-types.mjs';

export type GroupsStatus = 'loading' | 'ready' | 'failed';

export type GroupCapacityState = 'over' | 'full' | 'empty' | null;

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
  overCapacityBy: number;
  capacityState: GroupCapacityState;
  ageRangeLabel: string;
  ageMinYears: number | null;
  ageMaxYears: number | null;
  tone: BoardTone;
  order: number;
  avatarInitials: string[];
  extraMemberCount: number;
  members: GroupMemberView[];
  blocksDelete: boolean;
  team: GroupTeamMember[];
}

export interface UnassignedChild {
  id: string;
  name: string;
  ageLabel: string;
  birthDate: string | null;
}

export interface NewGroupInput {
  tone?: string;
  ageMinRaw?: string;
  ageMaxRaw?: string;
}

export interface GroupsData {
  status: GroupsStatus;
  failureMessage: string;
  groups: GroupCardView[];
  unassignedChildren: UnassignedChild[];
  openGroupId: string | null;
  busy: boolean;
  toggleGroup: (id: string) => void;
  createGroup: (name: string, capacityRaw: string, options?: NewGroupInput) => Promise<string>;
  updateGroup: (id: string, name: string, capacityRaw: string, educator: string) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  assignChild: (groupId: string, childId: string) => Promise<void>;
  removeChild: (childId: string) => Promise<void>;
  reorderGroups: (draggedId: string, targetId: string) => Promise<void>;
  moveGroup: (groupId: string, direction: -1 | 1) => Promise<void>;
  saveTeam: (groupId: string, team: GroupTeamMember[]) => Promise<void>;
}

function parseCapacity(capacityRaw: string): number | null {
  const trimmed = capacityRaw.trim();
  return trimmed ? Number(trimmed) : null;
}

function parseAgeYears(raw: string | undefined): number | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

function buildGroupCard(
  group: Group,
  allGroups: Group[],
  activeChildren: Child[],
  allChildren: Child[],
): GroupCardView {
  const members = activeChildren
    .filter(child => child.groupId === group.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  const memberCount = members.length;
  const overCapacity = group.capacity != null && memberCount > group.capacity;
  const capacityState: GroupCapacityState =
    group.capacity != null && overCapacity
      ? 'over'
      : group.capacity != null && memberCount === group.capacity && group.capacity > 0
        ? 'full'
        : memberCount === 0
          ? 'empty'
          : null;
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
  const blocksDelete = allChildren.some(child => child.groupId === group.id);

  return {
    id: group.id,
    name: group.name,
    educator: group.educator ?? '',
    capacity: group.capacity,
    memberCount,
    occupancyLabel,
    occupancyPercent,
    overCapacity,
    overCapacityBy: overCapacity ? memberCount - (group.capacity as number) : 0,
    capacityState,
    ageRangeLabel,
    ageMinYears: group.ageMinYears ?? null,
    ageMaxYears: group.ageMaxYears ?? null,
    tone: boardTone(group, allGroups),
    order: 0, // suprascris mai jos, după sortare — vezi useGroups
    avatarInitials: members.slice(0, 5).map(child => initials(child.name)),
    extraMemberCount: Math.max(0, memberCount - 5),
    members: members.map(child => ({ id: child.id, name: child.name, ageLabel: formatAge(child.birthDate) })),
    blocksDelete,
    team: group.team ?? [],
  };
}

/** openGroupId trăiește aici, nu în fiecare card, ca un singur editor să fie deschis o dată. */
export function useGroups(): GroupsData {
  const session = useAppSession();
  const { state, ready, loading, saveError, busy: mutationInFlight, pending } = session.state;
  const records = state as RecordsSnapshot;
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const busy = mutationInFlight || Boolean(pending);

  /** Persistă ordinea 0..N-1 pentru grupele a căror poziție efectivă s-a schimbat față de `next`
   * (inclusiv „migrarea” lazy a celor fără `order` explicit, la prima reordonare). */
  async function persistOrder(next: Group[]) {
    for (let index = 0; index < next.length; index++) {
      const group = next[index];
      if (group.order !== index) {
        await session.mutate('/api/record', { type: 'groups', mode: 'update', record: { ...group, order: index } });
      }
    }
  }

  async function reorderGroups(draggedId: string, targetId: string) {
    if (draggedId === targetId || busy) return;
    const current = sortByGroupOrder(records.groups);
    const fromIndex = current.findIndex(group => group.id === draggedId);
    const toIndex = current.findIndex(group => group.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...current];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    await persistOrder(next);
  }

  async function moveGroup(groupId: string, direction: -1 | 1) {
    if (busy) return;
    const current = sortByGroupOrder(records.groups);
    const index = current.findIndex(group => group.id === groupId);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= current.length) return;
    const next = [...current];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    await persistOrder(next);
  }

  function toggleGroup(id: string) {
    setOpenGroupId(current => (current === id ? null : id));
  }

  async function createGroup(name: string, capacityRaw: string, options: NewGroupInput = {}) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Completează numele grupei.');
    if (records.groups.some(group => group.name.toLocaleLowerCase('ro-RO') === trimmed.toLocaleLowerCase('ro-RO')))
      throw new Error(`Există deja o grupă ${trimmed}.`);
    const ageMinYears = parseAgeYears(options.ageMinRaw);
    const ageMaxYears = parseAgeYears(options.ageMaxRaw);
    // Grupa nouă apare prima (§5b.6) — restul grupelor coboară cu o poziție.
    const existing = sortByGroupOrder(records.groups);
    const id = `GRP-${crypto.randomUUID()}`;
    await session.mutate('/api/record', {
      type: 'groups',
      mode: 'create',
      record: {
        id,
        name: trimmed,
        capacity: parseCapacity(capacityRaw),
        order: 0,
        ...(options.tone ? { tone: options.tone } : {}),
        ...(ageMinYears !== undefined ? { ageMinYears } : {}),
        ...(ageMaxYears !== undefined ? { ageMaxYears } : {}),
      },
    });
    for (let index = 0; index < existing.length; index++) {
      const group = existing[index];
      const nextOrder = index + 1;
      if (group.order !== nextOrder) {
        await session.mutate('/api/record', { type: 'groups', mode: 'update', record: { ...group, order: nextOrder } });
      }
    }
    return id;
  }

  async function updateGroup(id: string, name: string, capacityRaw: string, educator: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Numele grupei nu poate fi gol.');
    const group = records.groups.find(candidate => candidate.id === id);
    if (!group) throw new Error('Grupa nu mai există.');
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
    const child = records.children.find(candidate => candidate.id === childId);
    if (!child) throw new Error('Copilul nu mai există.');
    await session.mutate('/api/record', { type: 'children', mode: 'update', record: { ...child, groupId } });
  }

  async function removeChild(childId: string) {
    const child = records.children.find(candidate => candidate.id === childId);
    if (!child) throw new Error('Copilul nu mai există.');
    await session.mutate('/api/record', { type: 'children', mode: 'update', record: { ...child, groupId: null } });
  }

  /** Echipa grupei (23i) — scrie Group.team prin mutația obișnuită de înregistrare. */
  async function saveTeam(groupId: string, team: GroupTeamMember[]) {
    const group = records.groups.find(candidate => candidate.id === groupId);
    if (!group) throw new Error('Grupa nu mai există.');
    await session.mutate('/api/record', { type: 'groups', mode: 'update', record: { ...group, team } });
  }

  const { groups, unassignedChildren } = useMemo(() => {
    if (!ready) return { groups: [] as GroupCardView[], unassignedChildren: [] as UnassignedChild[] };
    const activeChildren = records.children.filter(child => !child.archived);
    const ordered = sortByGroupOrder(records.groups);
    const groups = ordered.map((group, index) => ({
      ...buildGroupCard(group, records.groups, activeChildren, records.children),
      order: index,
    }));
    // Fără grupă e mereu prima (§4) — ordonată după data nașterii, cei mai mici (cei mai
    // recent născuți) primii.
    const unassignedChildren = activeChildren
      .filter(child => !child.groupId)
      .sort((a, b) => (b.birthDate ?? '').localeCompare(a.birthDate ?? ''))
      .map(child => ({
        id: child.id,
        name: child.name,
        ageLabel: formatAge(child.birthDate),
        birthDate: child.birthDate ?? null,
      }));
    return { groups, unassignedChildren };
  }, [ready, records.children, records.groups]);

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      groups: [],
      unassignedChildren: [],
      openGroupId,
      busy,
      toggleGroup,
      createGroup,
      updateGroup,
      deleteGroup,
      assignChild,
      removeChild,
      reorderGroups,
      moveGroup,
      saveTeam,
    };
  }

  return {
    status: 'ready',
    failureMessage: '',
    groups,
    unassignedChildren,
    openGroupId,
    busy,
    toggleGroup,
    createGroup,
    updateGroup,
    deleteGroup,
    assignChild,
    removeChild,
    reorderGroups,
    moveGroup,
    saveTeam,
  };
}

export { ageInYears };
