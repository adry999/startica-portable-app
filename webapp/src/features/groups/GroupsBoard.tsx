import { useMemo, useState, type DragEvent, type FormEvent } from 'react';
import { useToast } from '@shared/ui';
import type { GroupsData } from './useGroups';
import styles from './GroupsBoard.module.css';

const COLUMN_TONES = ['columnOrange', 'columnMint', 'columnYellow', 'columnPink'] as const;

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
  cards: BoardCard[];
}

/** „Grupe" (1h) — tablă cu coloane, drag&drop pentru realocare. Reutilizează mutațiile din useGroups (1g). */
export function GroupsBoard({ data }: { data: GroupsData }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);

  const columns = useMemo<BoardColumn[]>(() => {
    const none: BoardColumn = {
      key: 'none',
      name: 'Fără grupă',
      toneClass: styles.columnNone,
      capacityLabel: null,
      occupancyPercent: 0,
      educatorLabel: '',
      cards: data.unassignedChildren.map(c => ({ id: c.id, name: c.name, ageLabel: c.ageLabel })),
    };
    const rest = data.groups.map((group, index) => ({
      key: group.id,
      name: group.name,
      toneClass: styles[COLUMN_TONES[index % COLUMN_TONES.length]],
      capacityLabel: group.occupancyLabel,
      occupancyPercent: group.occupancyPercent,
      educatorLabel: group.educator || '+ Setează educator',
      cards: group.members.map(m => ({ id: m.id, name: m.name, ageLabel: m.ageLabel })),
    }));
    return [none, ...rest];
  }, [data.unassignedChildren, data.groups]);

  const normalizedSearch = search.trim().toLocaleLowerCase('ro-RO');
  const visibleColumns = normalizedSearch
    ? columns.map(col => ({
        ...col,
        cards: col.cards.filter(c => c.name.toLocaleLowerCase('ro-RO').includes(normalizedSearch)),
      }))
    : columns;

  async function handleDrop(targetKey: string, childId: string) {
    const sourceColumn = columns.find(col => col.cards.some(c => c.id === childId));
    if (!sourceColumn || sourceColumn.key === targetKey) return;
    try {
      if (targetKey === 'none') await data.removeChild(childId);
      else await data.assignChild(targetKey, childId);
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  return (
    <div className={styles.board}>
      <div className={styles.boardHead}>
        <h2 className={styles.boardTitle}>Grupe</h2>
        <input
          className={styles.search}
          type="search"
          placeholder="Caută copil"
          value={search}
          onChange={event => setSearch(event.target.value)}
          aria-label="Caută copil în tablă"
        />
        <button type="button" className={styles.btnPrimary} onClick={() => setNewGroupOpen(open => !open)}>
          + Grupă nouă
        </button>
      </div>

      {newGroupOpen && (
        <NewGroupInline
          onCreate={async (name, capacityRaw) => {
            try {
              await data.createGroup(name, capacityRaw);
              toast.show({ message: 'Grupă creată.' });
              setNewGroupOpen(false);
            } catch (error) {
              toast.show({ message: (error as Error).message });
            }
          }}
          onCancel={() => setNewGroupOpen(false)}
        />
      )}

      <div className={styles.boardToolbar}>
        <span>Trage un copil dintr-o coloană în alta pentru a-l realoca.</span>
        <button
          type="button"
          className={styles.btnGhost}
          onClick={() => setCollapsed(Object.fromEntries(columns.map(c => [c.key, true])))}
        >
          Restrânge tot
        </button>
        <button type="button" className={styles.btnGhost} onClick={() => setCollapsed({})}>
          Deschide tot
        </button>
      </div>

      <div className={styles.columns}>
        {visibleColumns.map(column =>
          collapsed[column.key] ? (
            <CollapsedColumn
              key={column.key}
              column={column}
              onExpand={() => setCollapsed(c => ({ ...c, [column.key]: false }))}
            />
          ) : (
            <OpenColumn
              key={column.key}
              column={column}
              dragOver={dragOverKey === column.key}
              onCollapse={() => setCollapsed(c => ({ ...c, [column.key]: true }))}
              onDragOverColumn={() => setDragOverKey(column.key)}
              onDragLeaveColumn={() => setDragOverKey(null)}
              onDropChild={childId => {
                setDragOverKey(null);
                void handleDrop(column.key, childId);
              }}
            />
          ),
        )}
      </div>
    </div>
  );
}

function onDragStartChild(event: DragEvent<HTMLDivElement>, childId: string) {
  event.dataTransfer.setData('text/plain', childId);
  event.dataTransfer.effectAllowed = 'move';
}

function OpenColumn({
  column,
  dragOver,
  onCollapse,
  onDragOverColumn,
  onDragLeaveColumn,
  onDropChild,
}: {
  column: BoardColumn;
  dragOver: boolean;
  onCollapse: () => void;
  onDragOverColumn: () => void;
  onDragLeaveColumn: () => void;
  onDropChild: (childId: string) => void;
}) {
  return (
    <div
      className={`${styles.column} ${column.toneClass} ${dragOver ? styles.columnDragOver : ''}`}
      onDragOver={event => {
        event.preventDefault();
        onDragOverColumn();
      }}
      onDragLeave={onDragLeaveColumn}
      onDrop={event => {
        event.preventDefault();
        onDropChild(event.dataTransfer.getData('text/plain'));
      }}
    >
      <div className={styles.columnHead}>
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
      {column.educatorLabel && <span className={styles.columnEducator}>{column.educatorLabel}</span>}
      <div className={styles.columnCards}>
        {column.cards.map(card => (
          <div
            key={card.id}
            className={styles.childCard}
            draggable
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

function CollapsedColumn({ column, onExpand }: { column: BoardColumn; onExpand: () => void }) {
  return (
    <button type="button" className={`${styles.collapsedColumn} ${column.toneClass}`} onClick={onExpand}>
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

function NewGroupInline({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string, capacityRaw: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [capacityRaw, setCapacityRaw] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onCreate(name, capacityRaw);
  }

  return (
    <form className={styles.newGroupInline} onSubmit={handleSubmit}>
      <input
        value={name}
        onChange={event => setName(event.target.value)}
        placeholder="Nume grupă"
        aria-label="Nume grupă nouă"
        autoFocus
      />
      <input
        value={capacityRaw}
        onChange={event => setCapacityRaw(event.target.value)}
        type="number"
        min={1}
        max={1000}
        placeholder="Locuri"
        aria-label="Capacitate grupă nouă"
      />
      <button type="submit" className={styles.btnPrimary}>
        Creează
      </button>
      <button type="button" className={styles.btnGhost} onClick={onCancel}>
        Anulează
      </button>
    </form>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');
}
