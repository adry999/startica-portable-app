import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Checkbox, Dialog, Icon, IconButton, groupTone } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { useKindergarten } from '@shared/api/useKindergarten';
import { usePersonal } from '@shared/personal/usePersonal';
import { usePersistedState } from '@shared/state/usePersistedState';
import { sortByGroupOrder } from '@shared/format/group-order';
import { today, shiftDays } from '@domain/calendar-month.mjs';
import type { RecordsSnapshot } from '@contracts/record-types.mjs';
import {
  WeeklySheet,
  buildWeeklySheetPages,
  formatWeekRangeShort,
  isChildActiveInWeek,
  isHistoricalWeek,
  mondayOf,
  sheetsForGroupCount,
  weeklySheetMessage,
  type WeeklySheetOptions,
} from './WeeklySheet';
import styles from './WeeklySheetDialog.module.css';

export interface WeeklySheetDialogProps {
  onClose: () => void;
}

/**
 * Fereastra „Foi de prezență pe săptămână” (18c) — o foaie A4 orizontală per grupă.
 * Montată doar cât timp e deschisă (AttendancePage/DayView), ca fiecare deschidere să pornească
 * cu săptămâna curentă și toate grupele selectate, fără efecte de resetare la fiecare montare.
 */
export function WeeklySheetDialog({ onClose }: WeeklySheetDialogProps) {
  const navigate = useNavigate();
  const session = useAppSession();
  const personal = usePersonal();
  const kindergarten = useKindergarten();
  // usePersistedState ține doar string — două chei sub același namespace `attendance.weeklySheet.*`,
  // ca opțiunile (nu și săptămâna, care revine mereu la cea curentă) să rămână memorate.
  const [showDetailsStr, setShowDetailsStr] = usePersistedState<'1' | '0'>('attendance.weeklySheet.info', '1');
  const [showNotesStr, setShowNotesStr] = usePersistedState<'1' | '0'>('attendance.weeklySheet.notes', '1');
  const options: WeeklySheetOptions = { showDetails: showDetailsStr === '1', showNotes: showNotesStr === '1' };
  const [week, setWeek] = useState(() => mondayOf(today()));

  const records = session.state.state as RecordsSnapshot;
  const groups = useMemo(() => sortByGroupOrder(records.groups), [records.groups]);

  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(() => groups.map(group => group.id));
  const [previewGroupId, setPreviewGroupId] = useState(() => groups[0]?.id ?? '');

  const childCountByGroup = useMemo(() => {
    const counts = new Map<string, number>();
    for (const group of groups) {
      const count = records.children.filter(
        child => child.groupId === group.id && isChildActiveInWeek(child, week),
      ).length;
      counts.set(group.id, count);
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, records.children, week]);

  function toggleGroup(groupId: string) {
    setSelectedGroupIds(current =>
      current.includes(groupId) ? current.filter(id => id !== groupId) : [...current, groupId],
    );
  }

  const totalSheets = selectedGroupIds.reduce(
    (sum, groupId) => sum + sheetsForGroupCount(childCountByGroup.get(groupId) ?? 0),
    0,
  );

  const previewGroup = groups.find(group => group.id === previewGroupId) ?? null;
  const previewChildren = previewGroup
    ? records.children
        .filter(child => child.groupId === previewGroup.id && isChildActiveInWeek(child, week))
        .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
    : [];
  const previewPage = previewGroup ? buildWeeklySheetPages(previewGroup, previewChildren, personal.staffById)[0] : null;

  function handleConfirm() {
    const params = new URLSearchParams({
      week,
      groups: selectedGroupIds.join(','),
      info: options.showDetails ? '1' : '0',
      notes: options.showNotes ? '1' : '0',
    });
    navigate(`/prezenta/foi?${params.toString()}`);
    onClose();
  }

  return (
    <Dialog
      open
      title="Foi de prezență pe săptămână"
      onClose={onClose}
      footer={
        <>
          <Button variant="white" onClick={onClose}>
            Anulează
          </Button>
          <Button disabled={selectedGroupIds.length === 0} onClick={handleConfirm}>
            {selectedGroupIds.length === 0 ? 'Alege o grupă' : `Tipărește ${totalSheets} foi`}
          </Button>
        </>
      }
    >
      <div className={styles.content}>
        <p className={styles.subtitle}>O foaie A4 orizontală pentru fiecare grupă.</p>

        <div className={styles.weekRow}>
          <span className={styles.label}>Săptămâna</span>
          <div className={styles.stepper}>
            <IconButton
              icon="chevron-left"
              ariaLabel="Săptămâna anterioară"
              className={styles.arrow}
              onClick={() => setWeek(current => shiftDays(current, -7))}
            />
            <span className={styles.stepperLabel}>{formatWeekRangeShort(week)}</span>
            <IconButton
              icon="chevron-right"
              ariaLabel="Săptămâna următoare"
              className={styles.arrow}
              onClick={() => setWeek(current => shiftDays(current, 7))}
            />
          </div>
        </div>

        {isHistoricalWeek(week) && <p className={styles.hint}>Copiii din grupa de azi</p>}

        <div className={styles.groupsHead}>
          <span className={styles.label}>
            Grupe · {selectedGroupIds.length} din {groups.length}
          </span>
          <div className={styles.quickActions}>
            <Button
              variant="link"
              className={styles.linkButton}
              onClick={() => setSelectedGroupIds(groups.map(g => g.id))}
            >
              Toate
            </Button>
            <Button variant="link" className={styles.linkButton} onClick={() => setSelectedGroupIds([])}>
              Fără grupe
            </Button>
          </div>
        </div>

        <div className={styles.pillRow}>
          {groups.map(group => {
            const tone = groupTone(group.id, groups);
            const selected = selectedGroupIds.includes(group.id);
            const className = selected
              ? `${styles.groupPill} ${styles.groupPillSelected} ${styles[tone]}`
              : styles.groupPill;
            return (
              <Button
                key={group.id}
                variant="outline"
                className={className}
                onClick={() => {
                  toggleGroup(group.id);
                  setPreviewGroupId(group.id);
                }}
              >
                {selected ? <Icon name="check" size={14} /> : '+'} {group.name} {childCountByGroup.get(group.id) ?? 0}
              </Button>
            );
          })}
        </div>

        <div className={styles.optionsBox}>
          <p className={styles.optionsHead}>16 rânduri pe foaie</p>
          <p className={styles.optionsNote}>
            Rândurile neocupate rămân libere pentru copii noi. Peste 16 copii, grupa trece pe a doua foaie.
          </p>
          <div className={styles.checkboxRow}>
            <Checkbox
              checked={options.showDetails}
              onChange={checked => setShowDetailsStr(checked ? '1' : '0')}
              ariaLabel="Alergii și detalii importante"
            />
            <span>Alergii și detalii importante</span>
          </div>
          <div className={styles.checkboxRow}>
            <Checkbox
              checked={options.showNotes}
              onChange={checked => setShowNotesStr(checked ? '1' : '0')}
              ariaLabel="Notițe pe zile"
            />
            <span>Notițe pe zile</span>
          </div>
        </div>

        {selectedGroupIds.length > 1 && (
          <div className={styles.previewTabs}>
            {selectedGroupIds.map(groupId => {
              const group = groups.find(g => g.id === groupId);
              if (!group) return null;
              const active = previewGroupId === groupId;
              return (
                <Button
                  key={groupId}
                  variant={active ? 'primary' : 'outline'}
                  className={active ? `${styles.previewTab} ${styles.previewTabActive}` : styles.previewTab}
                  onClick={() => setPreviewGroupId(groupId)}
                >
                  {group.name}
                </Button>
              );
            })}
          </div>
        )}

        {previewGroup && previewPage && (
          <div className={styles.previewFrame}>
            <div className={styles.previewScale}>
              <WeeklySheet
                page={previewPage}
                weekStart={week}
                branchName={session.state.branch?.name || kindergarten.settings?.displayName || ''}
                kindergarten={kindergarten.settings}
                options={options}
              />
            </div>
          </div>
        )}

        {previewGroup && (
          <p className={styles.message}>
            {weeklySheetMessage(
              previewGroup.name,
              childCountByGroup.get(previewGroup.id) ?? 0,
              sheetsForGroupCount(childCountByGroup.get(previewGroup.id) ?? 0),
            )}
          </p>
        )}
      </div>
    </Dialog>
  );
}
