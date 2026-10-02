import { useEffect, useState } from 'react';
import { Button, Drawer, Icon, IconButton, NumberInput, TextInput, TonePicker } from '@shared/ui';
import { useUnsavedChangesGuard } from '@shared/state/useUnsavedChangesGuard';
import { ageInYears } from '#shared/format/date-format.mjs';
import type { Staff, Leave } from '@shared/personal/personal.types';
import type { GroupTeamMember } from '@contracts/record-types.mjs';
import { GroupTile } from './GroupTile';
import { GroupTeamPicker } from './GroupTeamPicker';
import { BOARD_TONE_PALETTE, firstUnusedTone, type BoardTone } from './groupBoardTone';
import type { GroupCardView, UnassignedChild } from './useGroups';
import styles from './GroupFormDrawer.module.css';

export interface GroupFormDrawerProps {
  open: boolean;
  groups: GroupCardView[];
  unassignedChildren: UnassignedChild[];
  staff: Staff[];
  roleName: (roleId: string) => string;
  leaves: Leave[];
  onSubmit: (
    name: string,
    capacityRaw: string,
    tone: string,
    ageMinRaw: string,
    ageMaxRaw: string,
    team: GroupTeamMember[],
  ) => Promise<void>;
  onClose: () => void;
}

const DEFAULT_CAPACITY = 14;

/** Drawer 4c „Grupă nouă” (03-grupe.md §5b) — previzualizare live + culoare + capacitate + vârstă. */
export function GroupFormDrawer({
  open,
  groups,
  unassignedChildren,
  staff,
  roleName,
  leaves,
  onSubmit,
  onClose,
}: GroupFormDrawerProps) {
  const [name, setName] = useState('');
  const [capacityRaw, setCapacityRaw] = useState(String(DEFAULT_CAPACITY));
  const [tone, setTone] = useState<BoardTone>(() => firstUnusedTone(groups));
  const [ageMinRaw, setAgeMinRaw] = useState('');
  const [ageMaxRaw, setAgeMaxRaw] = useState('');
  const [team, setTeam] = useState<GroupTeamMember[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setName('');
      setCapacityRaw(String(DEFAULT_CAPACITY));
      setTone(firstUnusedTone(groups));
      setAgeMinRaw('');
      setAgeMaxRaw('');
      setTeam([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(): Promise<boolean> {
    if (submitting) return false;
    setSubmitting(true);
    try {
      await onSubmit(name, capacityRaw, tone, ageMinRaw, ageMaxRaw, team);
      return true;
    } finally {
      setSubmitting(false);
    }
  }

  const dirty =
    open &&
    (name !== '' ||
      capacityRaw !== String(DEFAULT_CAPACITY) ||
      ageMinRaw !== '' ||
      ageMaxRaw !== '' ||
      team.length > 0);
  // 40c: × / Esc / fundalul Drawer-ului trec prin `requestClose`, nu direct prin `onClose`.
  const unsavedGuard = useUnsavedChangesGuard({
    dirty,
    label: 'o grupă',
    formName: 'grupa nouă',
    save: handleSubmit,
    onClose,
  });

  const capacity = Number(capacityRaw) || DEFAULT_CAPACITY;
  const ageMin = ageMinRaw.trim() ? Number(ageMinRaw) : null;
  const ageMax = ageMaxRaw.trim() ? Number(ageMaxRaw) : null;
  const ageRangeLabel = ageMin != null && ageMax != null ? `${ageMin}–${ageMax} ani` : '—';

  const previewGroup: GroupCardView = {
    id: '__preview__',
    name: name.trim() || 'Grupă nouă',
    educator: '',
    educatorIsLegacy: false,
    capacity,
    memberCount: 0,
    occupancyLabel: `0/${capacity}`,
    occupancyPercent: 0,
    overCapacity: false,
    overCapacityBy: 0,
    capacityState: 'empty',
    ageRangeLabel,
    ageMinYears: ageMin,
    ageMaxYears: ageMax,
    tone,
    order: 0,
    avatarInitials: [],
    extraMemberCount: 0,
    members: [],
    blocksDelete: false,
    blockingChildCount: 0,
    team: [],
  };

  const usedByTone = new Map<BoardTone, string>();
  for (const group of groups) usedByTone.set(group.tone, group.name);

  const matchingCount = unassignedChildren.filter(child => {
    const years = ageInYears(child.birthDate ?? '');
    if (years === null) return false;
    if (ageMin != null && years < ageMin) return false;
    if (ageMax != null && years > ageMax) return false;
    return true;
  }).length;
  const footerNote =
    ageMin != null || ageMax != null
      ? `${matchingCount} ${matchingCount === 1 ? 'copil fără grupă are' : 'copii fără grupă au'} ${ageRangeLabel} · îi poți adăuga după salvare.`
      : `${unassignedChildren.length} ${unassignedChildren.length === 1 ? 'copil fără grupă' : 'copii fără grupă'} · îi poți adăuga după salvare.`;

  return (
    <>
      <Drawer
        open={open}
        title="Grupă nouă"
        size="detail"
        onClose={unsavedGuard.requestClose}
        footer={
          <div className={styles.footer}>
            <p className={styles.footerNote}>{footerNote}</p>
            <div className={styles.footerActions}>
              <Button type="button" variant="outline" onClick={unsavedGuard.requestClose}>
                Anulează
              </Button>
              <Button type="submit" form="group-form-drawer" loading={submitting} disabled={!name.trim()}>
                Creează grupa
              </Button>
            </div>
          </div>
        }
      >
        <form
          id="group-form-drawer"
          className={styles.form}
          autoComplete="off"
          onSubmit={event => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <GroupTile
            group={previewGroup}
            busy
            dragOver={false}
            onDragOverTile={() => {}}
            onDragLeaveTile={() => {}}
            onDropChild={() => {}}
            onDropGroup={() => {}}
            onMove={() => {}}
          />

          <label className={styles.field}>
            Nume grupă
            <TextInput value={name} onChange={setName} placeholder="ex. Ursuleți" />
          </label>

          <div className={styles.field}>
            Culoare
            <TonePicker
              ariaLabel="Culoare"
              tones={BOARD_TONE_PALETTE}
              value={tone}
              onChange={value => setTone(value as BoardTone)}
              titleFor={option => {
                const usedBy = usedByTone.get(option as BoardTone);
                return usedBy ? `folosită de ${usedBy}` : 'liberă';
              }}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              {/* Label separat de control, nu unul care-l înfășoară: un <label> care conține și
                cele două butoane +/- (labelabile ca orice control) ar face `getByLabelText`/lectorul
                de ecran să lege eticheta de primul buton, nu de input. */}
              <label htmlFor="new-group-capacity">Capacitate</label>
              <div className={styles.stepper}>
                <IconButton
                  icon="minus"
                  ariaLabel="Scade capacitatea"
                  onClick={() => setCapacityRaw(String(Math.max(1, Number(capacityRaw || DEFAULT_CAPACITY) - 1)))}
                />
                <NumberInput
                  id="new-group-capacity"
                  className={styles.capacityInput}
                  value={capacityRaw}
                  onChange={setCapacityRaw}
                  min={1}
                  max={1000}
                  step={1}
                />
                <IconButton
                  icon="plus"
                  ariaLabel="Crește capacitatea"
                  onClick={() => setCapacityRaw(String(Math.min(1000, Number(capacityRaw || DEFAULT_CAPACITY) + 1)))}
                />
              </div>
            </div>

            <label className={styles.field}>
              Vârstă minimă (ani)
              <NumberInput value={ageMinRaw} onChange={setAgeMinRaw} min={0} max={18} step={1} />
            </label>
            <label className={styles.field}>
              Vârstă maximă (ani)
              <NumberInput value={ageMaxRaw} onChange={setAgeMaxRaw} min={0} max={18} step={1} />
            </label>
          </div>

          <GroupTeamPicker
            currentGroupId={null}
            team={team}
            onChange={setTeam}
            staff={staff}
            roleName={roleName}
            allGroups={groups.map(group => ({ id: group.id, name: group.name, team: group.team }))}
            leaves={leaves}
            showDays={false}
          />

          <p className={styles.orderNote}>
            Grupa nouă apare prima, lângă „Fără grupă”, ca să tragi copiii direct în ea. Apoi o muți unde vrei cu
            mânerul <Icon name="grip-vertical" size={14} style={{ verticalAlign: 'text-bottom' }} />.
          </p>
        </form>
      </Drawer>
      {unsavedGuard.confirmDialog}
    </>
  );
}
