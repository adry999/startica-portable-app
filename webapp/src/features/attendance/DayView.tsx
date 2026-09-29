import { useState } from 'react';
import { Button, FilterPills, LoadingState, groupTone, type PillTone } from '@shared/ui';
import { ChildTile } from './ChildTile';
import { ExcuseReasonPopover } from './ExcuseReasonPopover';
import type { AttendanceDayData } from './useAttendanceDay';
import styles from './DayView.module.css';

const SECTION_TONE_CLASS: Record<PillTone, string> = {
  orange: styles.sectionOrange,
  mint: styles.sectionMint,
  yellow: styles.sectionYellow,
  pink: styles.sectionPink,
  teal: styles.sectionTeal,
  blue: styles.sectionBlue,
  purple: styles.sectionPurple,
  coral: styles.sectionCoral,
  neutral: styles.sectionNeutral,
};

export interface DayViewProps {
  data: AttendanceDayData;
  /** Deschide fereastra „Foi de prezență pe săptămână” (26-foaie-saptamana.md §3). */
  onOpenWeeklySheet: () => void;
  /** Lunea, butonul e principal (portocaliu plin); în celelalte zile, contur portocaliu. */
  weeklySheetIsMonday: boolean;
}

/** Ecranul Ziua (18a): 4 carduri, filtru de grupă, o secțiune de plăci per grupă. */
export function DayView({ data, onOpenWeeklySheet, weeklySheetIsMonday }: DayViewProps) {
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

  const totalMarked = data.counts.present + data.counts.absent + data.counts.excused;
  const totalChildren = totalMarked + data.counts.unmarked;
  const presentRate = totalChildren > 0 ? Math.round((data.counts.present / totalChildren) * 100) : 0;
  const barTotal = totalChildren > 0 ? totalChildren : 1;

  return (
    <div className={styles.root}>
      {/* A3c: cele 4 carduri mari devin o bandă compactă — 4 contoare pe un rând + bară proporțională. */}
      <div className={styles.summary}>
        <div className={styles.counters}>
          <span className={`${styles.counter} ${styles.counterPresent}`}>
            <span className={styles.counterDot} />
            <span className={data.counts.present === 0 ? `${styles.counterValue} ${styles.zero}` : styles.counterValue}>
              {data.counts.present}
            </span>
            <span className={styles.counterLabel}>Prezenți</span>
          </span>
          <span className={`${styles.counter} ${styles.counterAbsent}`}>
            <span className={styles.counterDot} />
            <span className={data.counts.absent === 0 ? `${styles.counterValue} ${styles.zero}` : styles.counterValue}>
              {data.counts.absent}
            </span>
            <span className={styles.counterLabel}>Absenți</span>
          </span>
          <span className={`${styles.counter} ${styles.counterExcused}`}>
            <span className={styles.counterDot} />
            <span className={data.counts.excused === 0 ? `${styles.counterValue} ${styles.zero}` : styles.counterValue}>
              {data.counts.excused}
            </span>
            <span className={styles.counterLabel}>Motivați</span>
          </span>
          <span className={styles.counter}>
            <span className={`${styles.counterDot} ${styles.counterDotUnmarked}`} />
            <span
              className={data.counts.unmarked === 0 ? `${styles.counterValue} ${styles.zero}` : styles.counterValue}
            >
              {data.counts.unmarked}
            </span>
            <span className={styles.counterLabel}>Nemarcați</span>
          </span>
          <span className={styles.presentRate}>{presentRate}% prezenți azi</span>
        </div>
        <div className={styles.progressBar}>
          {data.counts.present > 0 && (
            <span className={styles.progressPresent} style={{ width: `${(data.counts.present / barTotal) * 100}%` }} />
          )}
          {data.counts.absent > 0 && (
            <span className={styles.progressAbsent} style={{ width: `${(data.counts.absent / barTotal) * 100}%` }} />
          )}
          {data.counts.excused > 0 && (
            <span className={styles.progressExcused} style={{ width: `${(data.counts.excused / barTotal) * 100}%` }} />
          )}
        </div>
      </div>

      <FilterPills
        groups={[{ label: 'Grupa', value: data.groupFilter, onChange: data.setGroupFilter, options: groupOptions }]}
        trailing={
          <span className={styles.trailing}>
            <Button
              variant={weeklySheetIsMonday ? 'primary' : 'outline'}
              style={weeklySheetIsMonday ? undefined : { borderColor: 'var(--orange)', color: 'var(--orange-ink)' }}
              onClick={onOpenWeeklySheet}
            >
              Foi pe săptămână
            </Button>
          </span>
        }
      />

      {data.sections.length === 0 && <p className={styles.notice}>Niciun copil înscris la această dată.</p>}

      {data.sections.map(section => (
        <div key={section.key} className={`${styles.section} ${SECTION_TONE_CLASS[section.tone]}`}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionName}>{section.name}</span>
            <span className={styles.sectionMeta}>
              {section.present} din {section.tiles.length} prezenți
              {section.unmarked > 0 && ` · ${section.unmarked} nemarcați`}
            </span>
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

      {data.sections.length > 0 && (
        <p className={styles.footNote}>
          <strong>Motivat</strong> cere un motiv scurt.
        </p>
      )}
    </div>
  );
}
