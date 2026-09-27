import { Fragment, useState, type FormEvent } from 'react';
import {
  Button,
  Card,
  ConfirmDeleteDialog,
  groupTone,
  LoadingState,
  RowMenu,
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

export interface GroupsPageProps {
  /** Grupe → ⋯ → „Stickere pentru grupă" — navigarea trăiește în App.tsx, ca acest ecran să rămână fără router. */
  onOpenGroupStickers?: (groupId: string) => void;
}

export function GroupsPage({ onOpenGroupStickers }: GroupsPageProps = {}) {
  const groupsData = useGroups();
  const toast = useToast();
  const [viewMode, setViewMode] = usePersistedState<ViewMode>('groups.viewMode', 'cards');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GroupCardView | null>(null);

  // Statistica din antet numără pe toate grupele, indiferent de modul ales (03-grupe.md #2).
  const childrenInGroups = groupsData.groups.reduce((sum, group) => sum + group.memberCount, 0);
  const unassignedCount = groupsData.unassignedChildren.length;

  useTopbarActions(
    <div className={styles.headerActions}>
      <span className={styles.headerStat}>
        {childrenInGroups} {childrenInGroups === 1 ? 'copil' : 'copii'} în grupe · {unassignedCount} fără grupă
      </span>
      <SegmentedControl ariaLabel="Vizualizare Grupe" options={VIEW_OPTIONS} value={viewMode} onChange={setViewMode} />
      {/* „+ Grupă nouă” apare doar în Tablă; în Carduri grupa nouă se creează din cardul punctat din grilă (03-grupe.md #2). */}
      {viewMode === 'board' && <Button onClick={() => setFormOpen(true)}>+ Grupă nouă</Button>}
    </div>,
  );

  if (groupsData.status === 'loading') return <LoadingState />;
  if (groupsData.status === 'failed')
    return <p className={styles.notice}>{groupsData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  const openGroup = groupsData.groups.find(group => group.id === groupsData.openGroupId) ?? null;

  async function submitNewGroup(name: string, capacityRaw: string) {
    try {
      await groupsData.createGroup(name, capacityRaw);
      toast.show({ message: 'Grupă creată.' });
      setFormOpen(false);
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function deleteGroupConfirmed(group: GroupCardView) {
    try {
      await groupsData.deleteGroup(group.id);
      toast.show({ message: 'Grupă ștearsă.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  return (
    <>
      <GroupFormDrawer open={formOpen} onSubmit={submitNewGroup} onClose={() => setFormOpen(false)} />

      {viewMode === 'board' ? (
        <GroupsBoard data={groupsData} />
      ) : (
        <div className={styles.grid}>
          {groupsData.groups.map(group => (
            <Fragment key={group.id}>
              <GroupTile
                group={group}
                tone={tileTone(group, groupsData.groups)}
                isOpen={group.id === groupsData.openGroupId}
                onToggle={() => groupsData.toggleGroup(group.id)}
                onOpenStickers={onOpenGroupStickers ? () => onOpenGroupStickers(group.id) : undefined}
              />
              {openGroup && openGroup.id === group.id && (
                <div className={styles.editorSlot}>
                  <GroupEditor
                    group={openGroup}
                    unassignedChildren={groupsData.unassignedChildren}
                    onSave={async (name, capacityRaw, educator) => {
                      try {
                        await groupsData.updateGroup(openGroup.id, name, capacityRaw, educator);
                        toast.show({ message: 'Grupă actualizată.' });
                      } catch (error) {
                        toast.show({ message: (error as Error).message });
                      }
                    }}
                    onDelete={() => setDeleteTarget(openGroup)}
                    onAssign={async childId => {
                      try {
                        await groupsData.assignChild(openGroup.id, childId);
                        toast.show({ message: 'Copil atribuit grupei.' });
                      } catch (error) {
                        toast.show({ message: (error as Error).message });
                      }
                    }}
                    onRemove={async childId => {
                      try {
                        await groupsData.removeChild(childId);
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
          <Card tone="dashed" onClick={() => setFormOpen(true)} className={styles.newGroupCard}>
            <span className={styles.newGroupLabel}>+ Grupă nouă</span>
          </Card>
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
  onOpenStickers?: () => void;
}

/** Cardul rămâne un div, nu un buton, ca RowMenu (⋯, un <details>) să nu ajungă imbricat într-un <button>. */
function GroupTile({ group, tone, isOpen, onToggle, onOpenStickers }: GroupTileProps) {
  return (
    <Card tone={tone} className={isOpen ? styles.tileOpen : undefined}>
      {onOpenStickers && (
        <div className={styles.tileMenu}>
          <RowMenu
            items={[{ label: 'Stickere pentru grupă', onClick: onOpenStickers }]}
            ariaLabel={`Acțiuni grupa ${group.name}`}
          />
        </div>
      )}
      <button type="button" className={styles.tileToggle} onClick={onToggle}>
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
      </button>
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
        <Button type="submit">Salvează</Button>
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
        <Button disabled={!selectedChildId} onClick={handleAssign}>
          + Adaugă
        </Button>
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
