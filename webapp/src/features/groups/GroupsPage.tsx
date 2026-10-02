import { useState, type FormEvent } from 'react';
import {
  Button,
  Card,
  ConfirmDeleteDialog,
  EMPTY_STATES,
  EmptyState,
  Field,
  IconButton,
  LoadingState,
  NumberInput,
  resolveEmptyStateTitle,
  SearchSelect,
  SegmentedControl,
  TextInput,
  UnsavedChangesDialog,
  useToast,
  useTopbarActions,
} from '@shared/ui';
import { usePersistedState } from '@shared/state/usePersistedState';
import { readDirtyForms, useDirtyForm, type DirtyForm } from '@shared/state/dirty-forms';
import { useAppSession } from '@shared/api/session';
import { usePersonal } from '@shared/personal/usePersonal';
import { isStaffInBranch } from '@shared/personal/timesheet-rules';
import type { Staff, Leave } from '@shared/personal/personal.types';
import type { GroupTeamMember } from '@contracts/record-types.mjs';
import { useLeaves } from '@shared/personal/useLeaves';
import { useGroups, type GroupCardView, type UnassignedChild } from './useGroups';
import { GroupsBoard } from './GroupsBoard';
import { GroupCardCompact } from './GroupCardCompact';
import { GroupFormDrawer } from './GroupFormDrawer';
import { GroupTeamPicker } from './GroupTeamPicker';
import styles from './GroupsPage.module.css';
import { toUserError } from '@shared/api/to-user-error';

/** Numele afișat al educatorului: principalul din `team`, cu revenire la textul vechi `educator`. */
function withComputedEducator(group: GroupCardView, staffById: Map<string, Staff>): GroupCardView {
  const principal = group.team.find(member => member.role === 'principal');
  const principalName = principal ? staffById.get(principal.staffId)?.name : undefined;
  const legacyName = group.educator.trim() || undefined;
  return {
    ...group,
    educator: principalName ?? legacyName ?? '',
    educatorIsLegacy: !principalName && Boolean(legacyName),
  };
}

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
  const session = useAppSession();
  const leavesData = useLeaves(String(new Date().getFullYear()));
  const toast = useToast();
  const staffById = new Map(personal.staff.map(person => [person.id, person]));
  // F29 (DECIZII 02.10): echipa unei grupe se alege doar din angajații filialei deschise.
  const openBranchId = session.state.branch?.id ?? '';
  const branchStaff = personal.staff.filter(person => isStaffInBranch(person, openBranchId));
  const displayGroups = groupsData.groups.map(group => withComputedEducator(group, staffById));
  const [viewMode, setViewMode] = usePersistedState<ViewMode>(VIEW_KEY, initialViewMode());
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GroupCardView | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<{ groupId: string; form: DirtyForm } | null>(null);
  const [savingBeforeSwitch, setSavingBeforeSwitch] = useState(false);

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
      toast.show({ message: toUserError(error) });
    }
  }

  async function submitNewGroup(
    name: string,
    capacityRaw: string,
    tone: string,
    ageMinRaw: string,
    ageMaxRaw: string,
    team: GroupTeamMember[],
  ) {
    try {
      const trimmedName = name.trim();
      const newId = await groupsData.createGroup(name, capacityRaw, { tone, ageMinRaw, ageMaxRaw });
      if (team.length > 0) await groupsData.saveTeam(newId, team);
      setFormOpen(false);
      setSelectedId(newId);
      toast.show({
        message: `Grupa ${trimmedName} a fost creată`,
        actionLabel: 'Anulează',
        onAction: () => void undoCreateGroup(newId),
      });
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  async function deleteGroupConfirmed(group: GroupCardView) {
    try {
      await groupsData.deleteGroup(group.id);
      toast.show({ message: 'Grupă ștearsă.' });
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  // 13b: editorul grupei selectate are modificări nesalvate — schimbarea grupei (card sau
  // „Extinde” din Tablă) cere confirmare, altfel operatorul pierde tăcut numele/capacitatea/
  // echipa editate pe grupa anterioară (F5).
  function selectGroup(groupId: string) {
    if (groupId === selectedId) return;
    const [form] = readDirtyForms().filter(candidate => candidate.label === 'o grupă');
    if (form) {
      setPendingSwitch({ groupId, form });
      return;
    }
    setSelectedId(groupId);
  }

  function stayOnCurrentGroup() {
    setPendingSwitch(null);
  }

  function discardAndSwitchGroup() {
    if (!pendingSwitch) return;
    setSelectedId(pendingSwitch.groupId);
    setPendingSwitch(null);
  }

  async function saveAndSwitchGroup() {
    if (!pendingSwitch) return;
    setSavingBeforeSwitch(true);
    try {
      const saved = await pendingSwitch.form.save();
      if (!saved) return;
      setSelectedId(pendingSwitch.groupId);
      setPendingSwitch(null);
    } finally {
      setSavingBeforeSwitch(false);
    }
  }

  return (
    <>
      <GroupFormDrawer
        open={formOpen}
        groups={groupsData.groups}
        unassignedChildren={groupsData.unassignedChildren}
        staff={branchStaff}
        roleName={personal.roleName}
        leaves={leavesData.leaves}
        onSubmit={submitNewGroup}
        onClose={() => setFormOpen(false)}
      />

      {viewMode === 'board' ? (
        <GroupsBoard
          data={{ ...groupsData, groups: displayGroups }}
          onOpenGroupStickers={onOpenGroupStickers}
          onExpandGroupInCards={groupId => {
            selectGroup(groupId);
            setViewMode('cards');
          }}
        />
      ) : (
        <div className={styles.cardsLayout}>
          <div className={styles.grid}>
            {displayGroups.map(group => (
              <GroupCardCompact
                key={group.id}
                group={group}
                selected={group.id === selectedGroup?.id}
                busy={groupsData.busy}
                dragOver={dragOverCardId === group.id}
                onSelect={() => selectGroup(group.id)}
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
              key={selectedGroup.id}
              group={selectedGroup}
              unassignedChildren={groupsData.unassignedChildren}
              staff={branchStaff}
              roleName={personal.roleName}
              allGroups={groupsData.groups}
              leaves={leavesData.leaves}
              onSave={async (name, capacityRaw, team) => {
                try {
                  await groupsData.updateGroup(selectedGroup.id, name, capacityRaw, selectedGroup.educator, team);
                  toast.show({ message: 'Grupă actualizată.' });
                } catch (error) {
                  toast.show({ message: toUserError(error) });
                }
              }}
              onDelete={() => setDeleteTarget(selectedGroup)}
              onAssign={async childId => {
                try {
                  await groupsData.assignChild(selectedGroup.id, childId);
                  toast.show({ message: 'Copil atribuit grupei.' });
                } catch (error) {
                  toast.show({ message: toUserError(error) });
                }
              }}
              onRemove={async childId => {
                try {
                  await groupsData.removeChild(childId);
                  toast.show({ message: 'Copil scos din grupă.' });
                } catch (error) {
                  toast.show({ message: toUserError(error) });
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

      <UnsavedChangesDialog
        open={pendingSwitch !== null}
        formName={`grupa ${selectedGroup?.name ?? ''}`}
        onDiscard={discardAndSwitchGroup}
        onStay={stayOnCurrentGroup}
        onSaveAndContinue={() => void saveAndSwitchGroup()}
        saving={savingBeforeSwitch}
      />
    </>
  );
}

interface GroupEditorProps {
  group: GroupCardView;
  unassignedChildren: UnassignedChild[];
  staff: Staff[];
  roleName: (roleId: string) => string;
  allGroups: GroupCardView[];
  leaves: Leave[];
  onSave: (name: string, capacityRaw: string, team: GroupTeamMember[]) => Promise<void>;
  onDelete: () => void;
  onAssign: (childId: string) => Promise<void>;
  onRemove: (childId: string) => Promise<void>;
}

/** Editorul de sub grilă (03-grupe.md §5) — mereu deschis pentru grupa selectată. */
function GroupEditor({
  group,
  unassignedChildren,
  staff,
  roleName,
  allGroups,
  leaves,
  onSave,
  onDelete,
  onAssign,
  onRemove,
}: GroupEditorProps) {
  const [name, setName] = useState(group.name);
  const [capacityRaw, setCapacityRaw] = useState(group.capacity != null ? String(group.capacity) : '');
  const [team, setTeam] = useState<GroupTeamMember[]>(group.team);
  const [selectedChildId, setSelectedChildId] = useState('');

  async function save(): Promise<boolean> {
    await onSave(name, capacityRaw, team);
    return true;
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    await save();
  }

  // 13b: nesalvat înseamnă că numele/capacitatea/echipa diferă de ultima stare confirmată a grupei.
  const dirty =
    name !== group.name ||
    capacityRaw !== (group.capacity != null ? String(group.capacity) : '') ||
    JSON.stringify(team) !== JSON.stringify(group.team);
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

      <form className={styles.editorRow} autoComplete="off" onSubmit={handleSave}>
        <Field label="Nume" htmlFor="edit-group-name">
          <TextInput id="edit-group-name" ariaLabel="Nume grupă" value={name} onChange={setName} />
        </Field>
        <Field label="Capacitate" htmlFor="edit-group-capacity">
          <NumberInput
            id="edit-group-capacity"
            value={capacityRaw}
            onChange={setCapacityRaw}
            min={1}
            max={1000}
            step={1}
          />
        </Field>
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
        <EmptyState
          variant={EMPTY_STATES['grupe.members'].variant}
          size="compact"
          title={resolveEmptyStateTitle(EMPTY_STATES['grupe.members'])}
        />
      ) : (
        <div className={styles.memberGrid}>
          {group.members.map(member => (
            <div key={member.id} className={styles.memberRow}>
              <span className={styles.avatar}>{member.name[0]?.toUpperCase()}</span>
              <span className={styles.memberName}>{member.name}</span>
              <span className={styles.memberAge}>{member.ageLabel}</span>
              <IconButton
                icon="close"
                ariaLabel={`Scoate ${member.name} din grupă`}
                title="Scoate din grupă"
                onClick={() => onRemove(member.id)}
              />
            </div>
          ))}
        </div>
      )}

      <GroupTeamPicker
        currentGroupId={group.id}
        team={team}
        onChange={setTeam}
        staff={staff}
        roleName={roleName}
        allGroups={allGroups}
        leaves={leaves}
        showDays
      />

      <div className={styles.deleteRow}>
        <Button
          variant="danger"
          onClick={onDelete}
          disabled={group.blocksDelete}
          title={
            group.blocksDelete
              ? 'Mută mai întâi copiii din grupă (inclusiv cei arhivați) pentru a o putea șterge.'
              : undefined
          }
        >
          Șterge grupa {group.name}
        </Button>
      </div>
    </Card>
  );
}
