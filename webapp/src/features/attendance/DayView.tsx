import { useState } from 'react';
import { Badge, Card, FilterPills, LoadingState, groupTone, type PillTone } from '@shared/ui';
import { AttendanceDot } from '@shared/attendance';
import { ChildTile } from './ChildTile';
import { ExcuseReasonPopover } from './ExcuseReasonPopover';
import type { AttendanceDayData } from './useAttendanceDay';
import styles from './DayView.module.css';

export interface DayViewProps {
  data: AttendanceDayData;
}

/** Ecranul Ziua (18a): 4 carduri, filtru de grupă, o secțiune de plăci per grupă. */
export function DayView({ data }: DayViewProps) {
  const [excuseTarget, setExcuseTarget] = useState<string | null>(null);

  if (data.status === 'loading') return <LoadingState />;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  function handleCycle(childId: string) {
    const next = data.cycle(childId);
    setExcuseTarget(next === 'excused' ? childId : null);
  }

  const groupOptions: { value: string; label: string; tone: PillTone }[] = [
    { value: '', label: 'Toate', tone: 'neutral' },
    ...data.groups.map(group => ({ value: group.id, label: group.name, tone: groupTone(group.id, data.groups) })),
  ];

  const cardValueClass = (value: number, toneClass?: string) => {
    if (value === 0) return `${styles.cardValue} ${styles.subtle}`;
    return toneClass ? `${styles.cardValue} ${toneClass}` : styles.cardValue;
  };

  return (
    <div className={styles.root}>
      <div className={styles.cards}>
        <Card tone="mint">
          <span className={styles.cardLabel}>Prezenți</span>
          <span className={cardValueClass(data.counts.present)}>{data.counts.present}</span>
        </Card>
        <Card>
          <span className={styles.cardLabel}>Absenți</span>
          <span className={cardValueClass(data.counts.absent, styles.cardValueAbsent)}>{data.counts.absent}</span>
        </Card>
        <Card>
          <span className={styles.cardLabel}>Motivați</span>
          <span className={cardValueClass(data.counts.excused, styles.cardValueExcused)}>{data.counts.excused}</span>
        </Card>
        <Card>
          <span className={styles.cardLabel}>Nemarcați</span>
          <span className={cardValueClass(data.counts.unmarked)}>{data.counts.unmarked}</span>
        </Card>
      </div>

      <FilterPills
        groups={[{ label: 'Grupa', value: data.groupFilter, onChange: data.setGroupFilter, options: groupOptions }]}
        trailing={
          <span className={styles.legend}>
            <AttendanceDot kind="present" size="sm" /> Prezent
            <AttendanceDot kind="absent" size="sm" /> Absent
            <AttendanceDot kind="excused" size="sm" /> Motivat
          </span>
        }
      />

      {data.sections.length === 0 && <p className={styles.notice}>Niciun copil înscris la această dată.</p>}

      {data.sections.map(section => (
        <div key={section.key} className={styles.section}>
          <div className={styles.sectionHead}>
            <Badge tone={section.tone}>{section.name}</Badge>
            <span className={styles.sectionMeta}>
              {section.present} din {section.tiles.length} prezenți
              {section.unmarked > 0 && ` · ${section.unmarked} nemarcați`}
            </span>
            <button
              type="button"
              className={styles.sectionAction}
              onClick={() => data.markGroupPresent(section.key)}
              disabled={section.unmarked === 0}
            >
              Nemarcații ({section.unmarked}) → prezenți
            </button>
          </div>
          <div className={styles.grid}>
            {section.tiles.map(tile => (
              <div key={tile.child.id} className={styles.tileWrap}>
                <ChildTile
                  name={tile.child.name}
                  initials={tile.initials}
                  status={tile.status}
                  tone={section.tone}
                  onClick={() => handleCycle(tile.child.id)}
                />
                {excuseTarget === tile.child.id && (
                  <ExcuseReasonPopover
                    childName={tile.child.name}
                    reason={tile.reason}
                    onSave={reason => {
                      data.setReason(tile.child.id, reason);
                      setExcuseTarget(null);
                    }}
                    onClose={() => setExcuseTarget(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
