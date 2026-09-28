import { Card } from '@shared/ui';
import { formatDayLabel } from '#shared/format/date-format.mjs';
import type { PoolSessionStatus } from '#features/pool/pool.types.d.mts';
import type { WeekDay, WeekStats } from '@shared/pool/usePool';
import styles from './WeekView.module.css';

const NEXT_STATE: Record<string, PoolSessionStatus | null> = {
  unmarked: 'present',
  present: 'absent',
  absent: 'excused',
  excused: null,
};

const STATE_LABEL: Record<string, string> = {
  present: 'Prezent',
  absent: 'Lipsă',
  excused: 'Motivat',
  cancelled: 'Anulat',
  unmarked: '—',
  scheduled: '',
};

export interface WeekViewProps {
  days: WeekDay[];
  stats: WeekStats;
  onCycle: (bookingId: string, date: string, next: PoolSessionStatus | null) => void;
}

/** Grila săptămânii (22a): oră × zi, clic ciclează Prezent → Lipsă → Motivat → nemarcat. */
export function WeekView({ days, stats, onCycle }: WeekViewProps) {
  const times = [...new Set(days.flatMap(day => day.slots.map(slot => slot.time)))].sort();

  return (
    <>
      <div className={styles.cards}>
        <Card className={styles.statCard}>
          <span className={styles.statValue}>{stats.scheduled}</span>
          <span className={styles.statLabel}>Programate</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statValue}>{stats.present}</span>
          <span className={styles.statLabel}>Prezenți</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statValue}>{stats.absent}</span>
          <span className={styles.statLabel}>Lipsă</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statValue}>{stats.excused}</span>
          <span className={styles.statLabel}>Motivat</span>
        </Card>
      </div>

      <div className={styles.grid} style={{ gridTemplateColumns: `72px repeat(${days.length}, 1fr)` }}>
        <div className={styles.headerCell} />
        {days.map(day => (
          <div key={day.date} className={styles.headerCell}>
            {formatDayLabel(day.date)}
          </div>
        ))}
        {times.map(time => (
          <div key={time} style={{ display: 'contents' }}>
            <div className={styles.timeCell}>{time}</div>
            {days.map(day => {
              const slot = day.slots.find(candidate => candidate.time === time);
              return (
                <div key={day.date + time} className={styles.cell}>
                  {slot?.entries.map(entry => {
                    const clickable = entry.state === 'unmarked' || entry.state in NEXT_STATE;
                    const next = NEXT_STATE[entry.state] ?? 'present';
                    return (
                      <button
                        key={entry.booking.id}
                        type="button"
                        disabled={!clickable}
                        className={`${styles.tile} ${styles[entry.state] ?? ''}`}
                        onClick={() => clickable && onCycle(entry.booking.id, day.date, next)}
                      >
                        <span className={styles.tileName}>{entry.child?.name ?? entry.booking.childId}</span>
                        {STATE_LABEL[entry.state] && (
                          <span className={styles.tileState}>{STATE_LABEL[entry.state]}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
