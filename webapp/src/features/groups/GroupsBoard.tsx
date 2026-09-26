import { useMemo, useState, type DragEvent } from 'react';
import { useToast } from '@shared/ui';
import { initials, type GroupsData } from './useGroups';
import styles from './GroupsBoard.module.css';

const COLUMN_TONES = ['columnOrange', 'columnMint', 'columnYellow', 'columnPink'] as const;
const GROUP_DRAG_TYPE = 'application/x-group-id';

interface BoardCard {
  id: string;
  name: string;
  ageLabel: string;
}

interface BoardColumn {
  key: string;
  name: string;
  toneClass: string;
  capacityLabel: string | null;
  occupancyPercent: number;
  educatorLabel: string;
  overCapacity: boolean;
  cards: BoardCard[];
}

export function GroupsBoard({ data: groupsData }: { data: GroupsData }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const columns = useMemo<BoardColumn[]>(() => {
    const none: BoardColumn = {
      key: 'none',
      name: 'Fără grupă',
      toneClass: styles.columnNone,
      capacityLabel: null,
      occupancyPercent: 0,
      educatorLabel: '',
      overCapacity: false,
      cards: groupsData.unassignedChildren.map(child => ({ id: child.id, name: child.name, ageLabel: child.ageLabel })),
    };
    const rest = groupsData.groups.map((group, index) => ({
      key: group.id,
      name: group.name,
      toneClass: group.overCapacity ? styles.columnPink : styles[COLUMN_TONES[index % COLUMN_TONES.length]],
      capacityLabel: group.occupancyLabel,
      occupancyPercent: group.occupancyPercent,
      educatorLabel: group.educator || '+ Setează educator',
      overCapacity: group.overCapacity,
      cards: group.members.map(member => ({ id: member.id, name: member.name, ageLabel: member.ageLabel })),
    }));
    return [none, ...rest];
  }, [groupsData.unassignedChildren, groupsData.groups]);

  const normalizedSearch = search.trim().toLocaleLowerCase('ro-RO');
  const visibleColumns = normalizedSearch
    ? columns.map(col => ({
        ...col,
        cards: col.cards.filter(card => card.name.toLocaleLowerCase('ro-RO').includes(normalizedSearch)),
      }))
    : columns;

  function moveGroup(groupKey: string, direction: -1 | 1) {
    const groupKeys = columns.filter(col => col.key !== 'none').map(col => col.key);
    const index = groupKeys.indexOf(groupKey);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= groupKeys.length) return;
    groupsData.reorderGroups(groupKey, groupKeys[targetIndex]);
  }

  async function handleDrop(targetKey: string, childId: string) {
    if (groupsData.busy) return;
    const sourceColumn = columns.find(col => col.cards.some(card => card.id === childId));
    if (!sourceColumn || sourceColumn.key === targetKey) return;
    try {
      if (targetKey === 'none') await groupsData.removeChild(childId);
      else await groupsData.assignChild(targetKey, childId);
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  return (
    <div className={styles.board}>
      <div className={styles.boardHead}>
        <input
          className={styles.search}
          type="search"
          placeholder="Caută copil"
          value={search}
          onChange={event => setSearch(event.target.value)}
          aria-label="Caută copil în tablă"
        />
        <button
          type="button"
          className={styles.btnGhost}
          onClick={() => setCollapsed(Object.fromEntries(columns.map(column => [column.key, true])))}
        >
          Restrânge tot
        </button>
        <button type="button" className={styles.btnGhost} onClick={() => setCollapsed({})}>
          Deschide tot
        </button>
      </div>

      <div className={`${styles.columns} ${groupsData.busy ? styles.columnsBusy : ''}`}>
        {visibleColumns.map(column => {
          const groupKeys = columns.filter(col => col.key !== 'none').map(col => col.key);
          const groupIndex = groupKeys.indexOf(column.key);
          return collapsed[column.key] ? (
            <CollapsedColumn
              key={column.key}
              column={column}
              busy={groupsData.busy}
              dragOver={dragOverKey === column.key}
              onExpand={() => setCollapsed(prev => ({ ...prev, [column.key]: false }))}
              onDragOverColumn={() => setDragOverKey(column.key)}
              onDragLeaveColumn={() => setDragOverKey(null)}
              onDropChild={childId => {
                setDragOverKey(null);
                void handleDrop(column.key, childId);
              }}
              onDropColumn={draggedKey => {
                setDragOverKey(null);
                groupsData.reorderGroups(draggedKey, column.key);
              }}
            />
          ) : (
            <OpenColumn
              key={column.key}
              column={column}
              busy={groupsData.busy}
              dragOver={dragOverKey === column.key}
              canMoveLeft={groupIndex > 0}
              canMoveRight={groupIndex !== -1 && groupIndex < groupKeys.length - 1}
              onMoveLeft={() => moveGroup(column.key, -1)}
              onMoveRight={() => moveGroup(column.key, 1)}
              onCollapse={() => setCollapsed(prev => ({ ...prev, [column.key]: true }))}
              onDragOverColumn={() => setDragOverKey(column.key)}
              onDragLeaveColumn={() => setDragOverKey(null)}
              onDropChild={childId => {
                setDragOverKey(null);
                void handleDrop(column.key, childId);
              }}
              onDropColumn={draggedKey => {
                setDragOverKey(null);
                groupsData.reorderGroups(draggedKey, column.key);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function onDragStartChild(event: DragEvent<HTMLDivElement>, childId: string) {
  event.dataTransfer.setData('text/plain', childId);
  event.dataTransfer.effectAllowed = 'move';
}

function onDragStartColumn(event: DragEvent<HTMLElement>, groupId: string) {
  event.dataTransfer.setData(GROUP_DRAG_TYPE, groupId);
  event.dataTransfer.effectAllowed = 'move';
}

function OpenColumn({
  column,
  busy,
  dragOver,
  canMoveLeft,
  canMoveRight,
  onMoveLeft,
  onMoveRight,
  onCollapse,
  onDragOverColumn,
  onDragLeaveColumn,
  onDropChild,
  onDropColumn,
}: {
  column: BoardColumn;
  busy: boolean;
  dragOver: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onCollapse: () => void;
  onDragOverColumn: () => void;
  onDragLeaveColumn: () => void;
  onDropChild: (childId: string) => void;
  onDropColumn: (draggedGroupId: string) => void;
}) {
  const reorderable = column.key !== 'none';
  return (
    <div
      className={`${styles.column} ${column.toneClass} ${dragOver ? styles.columnDragOver : ''}`}
      onDragOver={event => {
        if (event.dataTransfer.types.includes(GROUP_DRAG_TYPE) && !reorderable) return;
        event.preventDefault();
        onDragOverColumn();
      }}
      onDragLeave={event => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        onDragLeaveColumn();
      }}
      onDrop={event => {
        event.preventDefault();
        if (event.dataTransfer.types.includes(GROUP_DRAG_TYPE)) {
          onDropColumn(event.dataTransfer.getData(GROUP_DRAG_TYPE));
        } else {
          onDropChild(event.dataTransfer.getData('text/plain'));
        }
      }}
    >
      <div
        className={styles.columnHead}
        draggable={reorderable && !busy}
        onDragStart={event => onDragStartColumn(event, column.key)}
      >
        <span className={styles.dragHandle} aria-hidden="true">
          {reorderable ? '⋮⋮' : ''}
        </span>
        {reorderable && (
          <>
            <button
              type="button"
              className={styles.columnMoveBtn}
              onClick={onMoveLeft}
              disabled={!canMoveLeft}
              aria-label={`Mută ${column.name} mai la stânga`}
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.columnMoveBtn}
              onClick={onMoveRight}
              disabled={!canMoveRight}
              aria-label={`Mută ${column.name} mai la dreapta`}
            >
              ›
            </button>
          </>
        )}
        <span className={styles.columnName}>{column.name}</span>
        <span className={styles.columnCount}>{column.capacityLabel ?? column.cards.length}</span>
        <button
          type="button"
          className={styles.columnToggle}
          onClick={onCollapse}
          aria-label={`Restrânge ${column.name}`}
        >
          −
        </button>
      </div>
      {column.capacityLabel && (
        <div className={styles.columnBar}>
          <span style={{ width: `${column.occupancyPercent}%` }} />
        </div>
      )}
      {column.overCapacity && <span className={styles.overCapacityBadge}>Peste capacitate</span>}
      {column.educatorLabel && <span className={styles.columnEducator}>{column.educatorLabel}</span>}
      <div className={styles.columnCards}>
        {column.cards.map(card => (
          <div
            key={card.id}
            className={styles.childCard}
            draggable={!busy}
            onDragStart={event => onDragStartChild(event, card.id)}
          >
            <span className={styles.dragHandle} aria-hidden="true">
              ⋮⋮
            </span>
            <span className={styles.childAvatar}>{initials(card.name)}</span>
            <span className={styles.childName}>{card.name}</span>
            <span className={styles.childAge}>{card.ageLabel}</span>
          </div>
        ))}
        {column.cards.length === 0 && <div className={styles.columnEmpty}>Plasează aici</div>}
      </div>
    </div>
  );
}

function CollapsedColumn({
  column,
  busy,
  dragOver,
  onExpand,
  onDragOverColumn,
  onDragLeaveColumn,
  onDropChild,
  onDropColumn,
}: {
  column: BoardColumn;
  busy: boolean;
  dragOver: boolean;
  onExpand: () => void;
  onDragOverColumn: () => void;
  onDragLeaveColumn: () => void;
  onDropChild: (childId: string) => void;
  onDropColumn: (draggedGroupId: string) => void;
}) {
  const reorderable = column.key !== 'none';
  return (
    <button
      type="button"
      className={`${styles.collapsedColumn} ${column.toneClass} ${dragOver ? styles.columnDragOver : ''}`}
      draggable={reorderable && !busy}
      onClick={onExpand}
      aria-label={`Deschide ${column.name}`}
      onDragStart={event => onDragStartColumn(event, column.key)}
      onDragOver={event => {
        if (event.dataTransfer.types.includes(GROUP_DRAG_TYPE) && !reorderable) return;
        event.preventDefault();
        onDragOverColumn();
      }}
      onDragLeave={event => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        onDragLeaveColumn();
      }}
      onDrop={event => {
        event.preventDefault();
        if (event.dataTransfer.types.includes(GROUP_DRAG_TYPE)) {
          onDropColumn(event.dataTransfer.getData(GROUP_DRAG_TYPE));
        } else {
          onDropChild(event.dataTransfer.getData('text/plain'));
        }
      }}
    >
      <span className={styles.columnToggle} aria-hidden="true">
        ⤢
      </span>
      <span className={styles.columnCount}>{column.cards.length}</span>
      {column.capacityLabel && (
        <div className={styles.collapsedBar}>
          <span style={{ height: `${column.occupancyPercent}%` }} />
        </div>
      )}
      <span className={styles.collapsedName}>{column.name}</span>
    </button>
  );
}

