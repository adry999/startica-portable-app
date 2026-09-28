import { useState, type FormEvent } from 'react';
import {
  Button,
  Card,
  ConfirmDeleteDialog,
  LoadingState,
  SearchSelect,
  SegmentedControl,
  useToast,
  useTopbarActions,
} from '@shared/ui';
import { usePersistedState } from '@shared/state/usePersistedState';
import { useDirtyForm } from '@shared/state/dirty-forms';
import { usePersonal } from '@shared/personal/usePersonal';
import type { Staff } from '@shared/personal/personal.types';
import type { GroupTeamMember } from '@contracts/record-types.mjs';
import { useGroups, type GroupCardView, type UnassignedChild } from './useGroups';
import { GroupsBoard } from './GroupsBoard';
import { GroupCardCompact } from './GroupCardCompact';
import { GroupFormDrawer } from './GroupFormDrawer';
import { GroupTeamCard } from './GroupTeamCard';
import styles from './GroupsPage.module.css';

type ViewMode = 'cards' | 'board';
const VIEW_OPTIONS = [
  { value: 'board' as const, label: 'Tablă' },
  { value: 'cards' as const, label: 'Carduri' },
];

const VIEW_KEY = 'view.groups';
const LEGACY_VIEW_KEY = 'groups.viewMode';

/** Implicit Tablă (03-grupe.md §2) — dar respectă alegerea veche a operatorului dacă există. */
function initialViewMode(): ViewMode {
  try {
    const current = localStorage.getItem(VIEW_KEY);
    if (current === 'board' || current === 'cards') return current;
    const legacy = localStorage.getItem(LEGACY_VIEW_KEY);
    if (legacy === 'board' || legacy === 'cards') return legacy;
  } catch {
    // localStorage indisponibil — cădem pe implicit.
  }
  return 'board';
}

export interface GroupsPageProps {
  /** Grupe → ⋯ → „Stickere pentru grupă" — navigarea trăiește în App.tsx, ca acest ecran să rămână fără router. */
  onOpenGroupStickers?: (groupId: string) => void;
}

export function GroupsPage({ onOpenGroupStickers }: GroupsPageProps = {}) {
  const groupsData = useGroups();
  const personal = usePersonal();
  const toast = useToast();
  const [viewMode, setViewMode] = usePersistedState<ViewMode>(VIEW_KEY, initialViewMode());
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GroupCardView | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  // Statistica din antet numără pe toate grupele, indiferent de modul ales (03-grupe.md §2).
  const childrenInGroups = groupsData.groups.reduce((sum, group) => sum + group.memberCount, 0);
  const unassignedCount = groupsData.unassignedChildren.length;

  useTopbarActions(
    <div className={styles.headerActions}>
      <span className={styles.headerStat}>
        {groupsData.groups.length} {groupsData.groups.length === 1 ? 'grupă' : 'grupe'} · {childrenInGroups}{' '}
        {childrenInGroups === 1 ? 'copil' : 'copii'} în grupe ·{' '}
        <b className={styles.headerStatStrong}>{unassignedCount} fără grupă</b>
      </span>
      <SegmentedControl ariaLabel="Vizualizare Grupe" options={VIEW_OPTIONS} value={viewMode} onChange={setViewMode} />
      <Button onClick={() => setFormOpen(true)}>+ Grupă nouă</Button>
    </div>,
  );

  if (groupsData.status === 'loading') return <LoadingState />;
  if (groupsData.status === 'failed')
    return <p className={styles.notice}>{groupsData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  const selectedGroup = groupsData.groups.find(group => group.id === selectedId) ?? groupsData.groups[0] ?? null;

  async function undoCreateGroup(id: string) {
    try {
      await groupsData.deleteGroup(id);
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function submitNewGroup(name: string, capacityRaw: string, tone: string, ageMinRaw: string, ageMaxRaw: string) {
    try {
      const trimmedName = name.trim();
      const newId = await groupsData.createGroup(name, capacityRaw, { tone, ageMinRaw, ageMaxRaw });
      setFormOpen(false);
      setSelectedId(newId);
      toast.show({
        message: `Grupa ${trimmedName} a fost creată`,
        actionLabel: 'Anulează',
        onAction: () => void undoCreateGroup(newId),
      });
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
      <GroupFormDrawer
        open={formOpen}
        groups={groupsData.groups}
        unassignedChildren={groupsData.unassignedChildren}
        onSubmit={submitNewGroup}
        onClose={() => setFormOpen(false)}
      />

      {viewMode === 'board' ? (
        <GroupsBoard
          data={groupsData}
          onOpenGroupStickers={onOpenGroupStickers}
          onExpandGroupInCards={groupId => {
            setSelectedId(groupId);
            setViewMode('cards');
          }}
        />
      ) : (
        <div className={styles.cardsLayout}>
          <div className={styles.grid}>
            {groupsData.groups.map(group => (
              <GroupCardCompact
                key={group.id}
                group={group}
                selected={group.id === selectedGroup?.id}
                busy={groupsData.busy}
                dragOver={dragOverCardId === group.id}
                onSelect={() => setSelectedId(group.id)}
                onDragOverCard={() => setDragOverCardId(group.id)}
                onDragLeaveCard={() => setDragOverCardId(null)}
                onDropGroup={draggedId => {
                  setDragOverCardId(null);
                  void groupsData.reorderGroups(draggedId, group.id);
                }}
                onOpenStickers={onOpenGroupStickers ? () => onOpenGroupStickers(group.id) : undefined}
              />
            ))}
          </div>

          {selectedGroup && (
            <GroupEditor
              group={selectedGroup}
              unassignedChildren={groupsData.unassignedChildren}
              staff={personal.staff}
              onSaveTeam={team => groupsData.saveTeam(selectedGroup.id, team)}
              onSave={async (name, capacityRaw, educator) => {
                try {
                  await groupsData.updateGroup(selectedGroup.id, name, capacityRaw, educator);
                  toast.show({ message: 'Grupă actualizată.' });
                } catch (error) {
                  toast.show({ message: (error as Error).message });
                }
              }}
              onDelete={() => setDeleteTarget(selectedGroup)}
              onAssign={async childId => {
                try {
                  await groupsData.assignChild(selectedGroup.id, childId);
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
          )}
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

interface GroupEditorProps {
  group: GroupCardView;
  unassignedChildren: UnassignedChild[];
  staff: Staff[];
  onSaveTeam: (team: GroupTeamMember[]) => Promise<void>;
  onSave: (name: string, capacityRaw: string, educator: string) => Promise<void>;
  onDelete: () => void;
  onAssign: (childId: string) => Promise<void>;
  onRemove: (childId: string) => Promise<void>;
}

/** Editorul de sub grilă (03-grupe.md §5) — mereu deschis pentru grupa selectată. */
function GroupEditor({
  group,
  unassignedChildren,
  staff,
  onSaveTeam,
  onSave,
  onDelete,
  onAssign,
  onRemove,
}: GroupEditorProps) {
  const [name, setName] = useState(group.name);
  const [capacityRaw, setCapacityRaw] = useState(group.capacity != null ? String(group.capacity) : '');
  const [educator, setEducator] = useState(group.educator);
  const [selectedChildId, setSelectedChildId] = useState('');

  async function save(): Promise<boolean> {
    await onSave(name, capacityRaw, educator);
    return true;
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    await save();
  }

  // 13b: nesalvat înseamnă că numele/educatorul/capacitatea diferă de ultima stare confirmată a grupei.
  const dirty =
    name !== group.name ||
    capacityRaw !== (group.capacity != null ? String(group.capacity) : '') ||
    educator !== group.educator;
  useDirtyForm(dirty ? { label: 'o grupă', save } : null);

  async function handleAssign() {
    if (!selectedChildId) return;
    await onAssign(selectedChildId);
    setSelectedChildId('');
  }

  return (
    <Card className={styles.editor}>
      <div className={styles.editorHead}>
        <h3 className={styles.editorTitle}>Editează grupa {group.name}</h3>
        <span className={styles.editorAges}>Vârste: {group.ageRangeLabel}</span>
      </div>

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

      <div className={styles.editorSubtitleRow}>
        <p className={styles.editorSubtitle}>Copii în grupă · {group.memberCount}</p>
        <SearchSelect
          className={styles.addSearch}
          options={unassignedChildren.map(child => ({ value: child.id, label: child.name }))}
          value={selectedChildId}
          onChange={setSelectedChildId}
          placeholder="Adaugă copil fără grupă…"
          emptyLabel="Niciun copil găsit"
          ariaLabel="Copil fără grupă"
          disabled={unassignedChildren.length === 0}
        />
        <Button disabled={!selectedChildId} onClick={handleAssign}>
          + Adaugă
        </Button>
      </div>

      {group.members.length === 0 ? (
        <p className={styles.emptyMembers}>Niciun copil în grupă. Caută mai sus sau trage-i din Tablă.</p>
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

      <GroupTeamCard
        group={{ id: group.id, name: group.name, capacity: group.capacity, team: group.team }}
        staff={staff}
        onSave={onSaveTeam}
      />

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
