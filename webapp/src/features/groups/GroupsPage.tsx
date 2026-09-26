import { Fragment, useState, type FormEvent } from 'react';
import {
  Card,
  ConfirmDeleteDialog,
  groupTone,
  SearchSelect,
  SegmentedControl,
  useToast,
  useTopbarActions,
  type CardTone,
} from '@shared/ui';
import { usePersistedState } from '@shared/state/usePersistedState';
import { useGroups, type GroupCardView, type UnassignedChild } from './useGroups';
import { GroupsBoard } from './GroupsBoard';
import { GroupFormDrawer } from './GroupFormDrawer';
import styles from './GroupsPage.module.css';

type ViewMode = 'cards' | 'board';
const VIEW_OPTIONS = [
  { value: 'cards' as const, label: 'Carduri' },
  { value: 'board' as const, label: 'Tablă' },
];

function tileTone(group: GroupCardView, groups: GroupCardView[]): CardTone {
  if (group.overCapacity) return 'pink';
  const tone = groupTone(group.id, groups);
  return tone === 'neutral' ? 'orange' : tone;
}

export function GroupsPage() {
  const data = useGroups();
  const toast = useToast();
  const [viewMode, setViewMode] = usePersistedState<ViewMode>('groups.viewMode', 'cards');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GroupCardView | null>(null);

  useTopbarActions(
    <div className={styles.headerActions}>
      <SegmentedControl ariaLabel="Vizualizare Grupe" options={VIEW_OPTIONS} value={viewMode} onChange={setViewMode} />
      <button type="button" className={styles.btnPrimary} onClick={() => setFormOpen(true)}>
        + Grupă nouă
      </button>
    </div>,
  );

  if (data.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  const openGroup = data.groups.find(group => group.id === data.openGroupId) ?? null;

  async function submitNewGroup(name: string, capacityRaw: string) {
    try {
      await data.createGroup(name, capacityRaw);
      toast.show({ message: 'Grupă creată.' });
      setFormOpen(false);
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function deleteGroupConfirmed(group: GroupCardView) {
    try {
      await data.deleteGroup(group.id);
      toast.show({ message: 'Grupă ștearsă.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  return (
    <>
      <GroupFormDrawer open={formOpen} onSubmit={submitNewGroup} onClose={() => setFormOpen(false)} />

      {viewMode === 'board' ? (
        <GroupsBoard data={data} />
      ) : (
        <div className={styles.grid}>
          {data.groups.map(group => (
            <Fragment key={group.id}>
              <GroupTile
                group={group}
                tone={tileTone(group, data.groups)}
                isOpen={group.id === data.openGroupId}
                onToggle={() => data.toggleGroup(group.id)}
              />
              {openGroup && openGroup.id === group.id && (
                <div className={styles.editorSlot}>
                  <GroupEditor
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
                    onDelete={() => setDeleteTarget(openGroup)}
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
                </div>
              )}
            </Fragment>
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title="Ștergere grupă"
        description={deleteTarget ? `Ștergi grupa „${deleteTarget.name}”?` : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void deleteGroupConfirmed(deleteTarget);
          setDeleteTarget(null);
        }}
      />
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

interface GroupEditorProps {
  group: GroupCardView;
  unassignedChildren: UnassignedChild[];
  onSave: (name: string, capacityRaw: string, educator: string) => Promise<void>;
  onDelete: () => void;
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
        <button type="submit" className={styles.btnPrimary}>
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
        <SearchSelect
          options={unassignedChildren.map(child => ({ value: child.id, label: child.name }))}
          value={selectedChildId}
          onChange={setSelectedChildId}
          placeholder={unassignedChildren.length ? 'Alege un copil…' : 'Niciun copil fără grupă'}
          emptyLabel="Niciun copil găsit"
          ariaLabel="Copil fără grupă"
          disabled={unassignedChildren.length === 0}
        />
        <button type="button" className={styles.btnPrimary} disabled={!selectedChildId} onClick={handleAssign}>
          + Adaugă
        </button>
      </div>

      <div className={styles.deleteRow}>
        <button
          type="button"
          className={styles.deleteButton}
          onClick={onDelete}
          disabled={group.blocksDelete}
          title={
            group.blocksDelete
              ? 'Mută mai întâi copiii din grupă (inclusiv cei arhivați) pentru a o putea șterge.'
              : undefined
          }
        >
          Șterge grupa {group.name}
        </button>
      </div>
    </Card>
  );
}
