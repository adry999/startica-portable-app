import { useEffect, useState } from 'react';
import { Button, Drawer } from '@shared/ui';
import { useDirtyForm } from '@shared/state/dirty-forms';
import { ageInYears } from '#shared/format/date-format.mjs';
import type { Staff, Leave } from '@shared/personal/personal.types';
import type { GroupTeamMember } from '@contracts/record-types.mjs';
import { GroupTile } from './GroupTile';
import { GroupTeamPicker } from './GroupTeamPicker';
import { BOARD_TONE_COLORS, BOARD_TONE_PALETTE, firstUnusedTone, type BoardTone } from './groupBoardTone';
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

const TONE_LABEL: Record<BoardTone, string> = {
  yellow: 'galben',
  pink: 'roz',
  teal: 'turcoaz',
  green: 'verde',
  blue: 'albastru',
  orange: 'portocaliu',
  purple: 'lila',
  coral: 'coral',
};

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
  useDirtyForm(dirty ? { label: 'o grupă', save: handleSubmit } : null);

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
    <Drawer
      open={open}
      title="Grupă nouă"
      width={520}
      onClose={onClose}
      footer={
        <div className={styles.footer}>
          <p className={styles.footerNote}>{footerNote}</p>
          <div className={styles.footerActions}>
            <Button type="button" variant="outline" onClick={onClose}>
              Anulează
            </Button>
            <Button type="submit" form="group-form-drawer" disabled={submitting || !name.trim()}>
              Creează grupa
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="group-form-drawer"
        className={styles.form}
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
          <input value={name} onChange={event => setName(event.target.value)} autoFocus placeholder="ex. Ursuleți" />
        </label>

        <div className={styles.field}>
          Culoare
          <div className={styles.swatchRow}>
            {BOARD_TONE_PALETTE.map(option => {
              const usedBy = usedByTone.get(option);
              return (
                <button
                  key={option}
                  type="button"
                  className={`${styles.swatch} ${tone === option ? styles.swatchActive : ''}`}
                  style={{ background: BOARD_TONE_COLORS[option].soft, borderColor: BOARD_TONE_COLORS[option].bar }}
                  aria-label={`Culoare ${TONE_LABEL[option]}`}
                  aria-pressed={tone === option}
                  title={usedBy ? `folosită de ${usedBy}` : 'liberă'}
                  onClick={() => setTone(option)}
                />
              );
            })}
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            {/* Label separat de `<input>`, nu unul care-l înfășoară: un <label> care conține și
                cele două butoane +/- (labelabile ca orice control) ar face `getByLabelText`/lectorul
                de ecran să lege eticheta de primul buton, nu de input. */}
            <label htmlFor="new-group-capacity">Capacitate</label>
            <div className={styles.stepper}>
              <button
                type="button"
                onClick={() => setCapacityRaw(String(Math.max(1, Number(capacityRaw || DEFAULT_CAPACITY) - 1)))}
                aria-label="Scade capacitatea"
              >
                −
              </button>
              <input
                id="new-group-capacity"
                value={capacityRaw}
                onChange={event => setCapacityRaw(event.target.value)}
                type="number"
                min={1}
                max={1000}
              />
              <button
                type="button"
                onClick={() => setCapacityRaw(String(Math.min(1000, Number(capacityRaw || DEFAULT_CAPACITY) + 1)))}
                aria-label="Crește capacitatea"
              >
                +
              </button>
            </div>
          </div>

          <label className={styles.field}>
            Vârstă minimă (ani)
            <input
              value={ageMinRaw}
              onChange={event => setAgeMinRaw(event.target.value)}
              type="number"
              min={0}
              max={18}
            />
          </label>
          <label className={styles.field}>
            Vârstă maximă (ani)
            <input
              value={ageMaxRaw}
              onChange={event => setAgeMaxRaw(event.target.value)}
              type="number"
              min={0}
              max={18}
            />
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
          Grupa nouă apare prima, lângă „Fără grupă”, ca să tragi copiii direct în ea. Apoi o muți unde vrei cu „⋮⋮”.
        </p>
      </form>
    </Drawer>
  );
}
