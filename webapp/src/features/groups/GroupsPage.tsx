import { useState, type FormEvent } from 'react';
import { Card, SegmentedControl, useToast, type CardTone } from '@shared/ui';
import { usePersistedState } from '@shared/state/usePersistedState';
import { useGroups, type GroupCardView, type UnassignedChild } from './useGroups';
import { GroupsBoard } from './GroupsBoard';
import styles from './GroupsPage.module.css';

const TILE_TONES: CardTone[] = ['orange', 'mint', 'yellow'];
type ViewMode = 'cards' | 'board';
const VIEW_OPTIONS = [
  { value: 'cards' as const, label: 'Carduri' },
  { value: 'board' as const, label: 'Tablă' },
];

function tileTone(index: number, overCapacity: boolean): CardTone {
  return overCapacity ? 'pink' : TILE_TONES[index % TILE_TONES.length];
}

export function GroupsPage() {
  const data = useGroups();
  const toast = useToast();
  const [viewMode, setViewMode] = usePersistedState<ViewMode>('groups.viewMode', 'cards');

  if (data.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  const openGroup = data.groups.find(group => group.id === data.openGroupId) ?? null;

  if (viewMode === 'board') {
    return (
      <>
        <div className={styles.viewToggleRow}>
          <SegmentedControl
            ariaLabel="Vizualizare Grupe"
            options={VIEW_OPTIONS}
            value={viewMode}
            onChange={setViewMode}
          />
        </div>
        <GroupsBoard data={data} />
      </>
    );
  }

  return (
    <>
      <div className={styles.viewToggleRow}>
        <SegmentedControl
          ariaLabel="Vizualizare Grupe"
          options={VIEW_OPTIONS}
          value={viewMode}
          onChange={setViewMode}
        />
      </div>
      <div className={styles.grid}>
        {data.groups.map((group, index) => (
          <GroupTile
            key={group.id}
            group={group}
            tone={tileTone(index, group.overCapacity)}
            isOpen={group.id === data.openGroupId}
            onToggle={() => data.toggleGroup(group.id)}
          />
        ))}
        <NewGroupTile
          onCreate={async (name, capacityRaw) => {
            try {
              await data.createGroup(name, capacityRaw);
              toast.show({ message: 'Grupă creată.' });
            } catch (error) {
              toast.show({ message: (error as Error).message });
            }
          }}
        />
      </div>

      {openGroup && (
        <GroupEditor
          key={openGroup.id}
          group={openGroup}
          unassignedChildren={data.unassignedChildren}
          onSave={async (name, capacityRaw, educator) => {
            try {
              await data.updateGroup(openGroup.id, name, capacityRaw, educator);
              toast.show({ message: 'Grupă actualizată.' });
            } catch (error) {
              toast.show({ message: (error as Error).message });
            }
          }}
          onDelete={async () => {
            if (!window.confirm(`Ștergi grupa „${openGroup.name}”? Copiii rămân, doar grupa este ștearsă.`)) return;
            try {
              await data.deleteGroup(openGroup.id);
              toast.show({ message: 'Grupă ștearsă.' });
            } catch (error) {
              toast.show({ message: (error as Error).message });
            }
          }}
          onAssign={async childId => {
            try {
              await data.assignChild(openGroup.id, childId);
              toast.show({ message: 'Copil atribuit grupei.' });
            } catch (error) {
              toast.show({ message: (error as Error).message });
            }
          }}
          onRemove={async childId => {
            try {
              await data.removeChild(childId);
              toast.show({ message: 'Copil scos din grupă.' });
            } catch (error) {
              toast.show({ message: (error as Error).message });
            }
          }}
        />
      )}
    </>
  );
}

interface GroupTileProps {
  group: GroupCardView;
  tone: CardTone;
  isOpen: boolean;
  onToggle: () => void;
}

function GroupTile({ group, tone, isOpen, onToggle }: GroupTileProps) {
  return (
    <Card tone={tone} onClick={onToggle} className={isOpen ? styles.tileOpen : undefined}>
      <div className={styles.tileHead}>
        <p className={styles.tileName}>{group.name}</p>
        <span className={styles.tilePill}>{isOpen ? '▴ Restrânge' : '▾ Deschide'}</span>
      </div>
      <strong className={styles.tileOccupancy}>{group.occupancyLabel}</strong>
      <div className={styles.occupancyBar}>
        {group.capacity != null && <span style={{ width: `${group.occupancyPercent}%` }} />}
      </div>
      <p className={styles.tileMeta}>
        {group.educator || 'fără educator'} · {group.ageRangeLabel}
      </p>
      {group.memberCount > 0 && (
        <div className={styles.avatarStack}>
          {group.avatarInitials.map((initial, index) => (
            <span key={index} className={styles.avatar}>
              {initial}
            </span>
          ))}
          {group.extraMemberCount > 0 && <span className={styles.avatarExtra}>+{group.extraMemberCount}</span>}
        </div>
      )}
    </Card>
  );
}

function NewGroupTile({ onCreate }: { onCreate: (name: string, capacityRaw: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [capacityRaw, setCapacityRaw] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onCreate(name, capacityRaw);
    setName('');
    setCapacityRaw('');
  }

  return (
    <Card tone="dashed" className={styles.newTile}>
      <p className={styles.tileName}>+ Grupă nouă</p>
      <form className={styles.newTileForm} onSubmit={handleSubmit}>
        <input
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="Nume grupă"
          aria-label="Nume grupă nouă"
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
        <button type="submit" className={styles.primaryButton}>
          Creează
        </button>
      </form>
    </Card>
  );
}

interface GroupEditorProps {
  group: GroupCardView;
  unassignedChildren: UnassignedChild[];
  onSave: (name: string, capacityRaw: string, educator: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onAssign: (childId: string) => Promise<void>;
  onRemove: (childId: string) => Promise<void>;
}

function GroupEditor({ group, unassignedChildren, onSave, onDelete, onAssign, onRemove }: GroupEditorProps) {
  const [name, setName] = useState(group.name);
  const [capacityRaw, setCapacityRaw] = useState(group.capacity != null ? String(group.capacity) : '');
  const [educator, setEducator] = useState(group.educator);
  const [selectedChildId, setSelectedChildId] = useState('');

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    await onSave(name, capacityRaw, educator);
  }

  async function handleAssign() {
    if (!selectedChildId) return;
    await onAssign(selectedChildId);
    setSelectedChildId('');
  }

  return (
    <Card className={styles.editor}>
      <form className={styles.editorRow} onSubmit={handleSave}>
        <label className={styles.field}>
          Nume
          <input value={name} onChange={event => setName(event.target.value)} aria-label="Nume grupă" />
        </label>
        <label className={styles.field}>
          Educator
          <input value={educator} onChange={event => setEducator(event.target.value)} aria-label="Educator" />
        </label>
        <label className={styles.field}>
          Capacitate
          <input
            value={capacityRaw}
            onChange={event => setCapacityRaw(event.target.value)}
            type="number"
            min={1}
            max={1000}
            aria-label="Capacitate"
          />
        </label>
        <button type="submit" className={styles.primaryButton}>
          Salvează
        </button>
      </form>

      <p className={styles.editorSubtitle}>
        Copii în grupă · {group.memberCount}
        {group.memberCount > 0 ? ` · ${group.ageRangeLabel}` : ''}
      </p>

      {group.members.length === 0 ? (
        <p className={styles.emptyMembers}>Niciun copil în grupă.</p>
      ) : (
        <div className={styles.memberGrid}>
          {group.members.map(member => (
            <div key={member.id} className={styles.memberRow}>
              <span className={styles.avatar}>{member.name[0]?.toUpperCase()}</span>
              <span className={styles.memberName}>{member.name}</span>
              <span className={styles.memberAge}>{member.ageLabel}</span>
              <button
                type="button"
                className={styles.removeButton}
                aria-label={`Scoate ${member.name} din grupă`}
                title="Scoate din grupă"
                onClick={() => onRemove(member.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.addRow}>
        <select
          value={selectedChildId}
          onChange={event => setSelectedChildId(event.target.value)}
          aria-label="Copil fără grupă"
          disabled={unassignedChildren.length === 0}
        >
          <option value="">{unassignedChildren.length ? 'Alege un copil…' : 'Niciun copil fără grupă'}</option>
          {unassignedChildren.map(child => (
            <option key={child.id} value={child.id}>
              {child.name}
            </option>
          ))}
        </select>
        <button type="button" className={styles.primaryButton} disabled={!selectedChildId} onClick={handleAssign}>
          + Adaugă
        </button>
      </div>

      <div className={styles.deleteRow}>
        <button type="button" className={styles.deleteButton} onClick={onDelete}>
          Șterge grupa {group.name}
        </button>
      </div>
    </Card>
  );
}
