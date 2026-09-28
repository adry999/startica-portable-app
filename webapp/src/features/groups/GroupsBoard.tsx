import { useState } from 'react';
import { SearchInput, useToast } from '@shared/ui';
import { initials } from '@shared/format/initials';
import { GroupTile } from './GroupTile';
import type { GroupsData } from './useGroups';
import styles from './GroupsBoard.module.css';

const POOL_KEY = 'pool';

export interface GroupsBoardProps {
  data: GroupsData;
  onOpenGroupStickers?: (groupId: string) => void;
  onExpandGroupInCards?: (groupId: string) => void;
}

/** Tablă (03-grupe.md §4) — panoul „Fără grupă” fix la stânga + grila de tile-uri ale grupelor. */
export function GroupsBoard({ data: groupsData, onOpenGroupStickers, onExpandGroupInCards }: GroupsBoardProps) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const normalizedSearch = search.trim().toLocaleLowerCase('ro-RO');
  const visiblePool = normalizedSearch
    ? groupsData.unassignedChildren.filter(child => child.name.toLocaleLowerCase('ro-RO').includes(normalizedSearch))
    : groupsData.unassignedChildren;

  async function handleDropChild(groupId: string, childId: string) {
    if (groupsData.busy || !childId) return;
    try {
      await groupsData.assignChild(groupId, childId);
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function handleDropToPool(childId: string) {
    if (groupsData.busy || !childId) return;
    try {
      await groupsData.removeChild(childId);
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  return (
    <div className={styles.board}>
      <aside
        className={`${styles.pool} ${dragOverKey === POOL_KEY ? styles.poolDragOver : ''}`}
        onDragOver={event => {
          if (!event.dataTransfer.types.includes('text/plain')) return;
          event.preventDefault();
          setDragOverKey(POOL_KEY);
        }}
        onDragLeave={event => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) return;
          setDragOverKey(null);
        }}
        onDrop={event => {
          event.preventDefault();
          const childId = event.dataTransfer.getData('text/plain');
          setDragOverKey(null);
          void handleDropToPool(childId);
        }}
      >
        <h3 className={styles.poolTitle}>
          Fără grupă <b>{groupsData.unassignedChildren.length}</b>
        </h3>
        <SearchInput value={search} onChange={setSearch} placeholder="Caută copil" ariaLabel="Caută copil fără grupă" />
        <p className={styles.hint}>Ordonați după vârstă · trage pe o grupă</p>
        <div className={styles.poolList}>
          {visiblePool.map(child => (
            <div
              key={child.id}
              className={styles.poolRow}
              draggable={!groupsData.busy}
              onDragStart={event => {
                event.dataTransfer.setData('text/plain', child.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
            >
              <span className={styles.poolHandle} aria-hidden="true">
                ⋮⋮
              </span>
              <span className={styles.poolAvatar}>{initials(child.name)}</span>
              <span className={styles.poolName}>{child.name}</span>
              <span className={styles.poolAge}>{child.ageLabel}</span>
            </div>
          ))}
          {visiblePool.length === 0 && <p className={styles.poolEmpty}>Niciun copil fără grupă.</p>}
        </div>
      </aside>

      <div className={`${styles.tiles} ${groupsData.busy ? styles.tilesBusy : ''}`}>
        {groupsData.groups.map(group => (
          <GroupTile
            key={group.id}
            group={group}
            busy={groupsData.busy}
            dragOver={dragOverKey === group.id}
            onDragOverTile={() => setDragOverKey(group.id)}
            onDragLeaveTile={() => setDragOverKey(null)}
            onDropChild={childId => {
              setDragOverKey(null);
              void handleDropChild(group.id, childId);
            }}
            onDropGroup={draggedId => {
              setDragOverKey(null);
              void groupsData.reorderGroups(draggedId, group.id);
            }}
            onMove={direction => void groupsData.moveGroup(group.id, direction)}
            onExpandOverflow={onExpandGroupInCards ? () => onExpandGroupInCards(group.id) : undefined}
            onOpenStickers={onOpenGroupStickers ? () => onOpenGroupStickers(group.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
