import { Card, groupTone } from '@shared/ui';
import { initials } from '@shared/format/initials';
import { today } from '@domain/calendar-month.mjs';
import type { PoolSessionStatus } from '#features/pool/pool.types.d.mts';
import type { WeekDay, WeekStats } from '@shared/pool/usePool';
import type { Group } from '@contracts/record-types.mjs';
import styles from './WeekView.module.css';

// Trecut/azi: nemarcat → prezent → lipsă → motivat → nemarcat. Viitor: programat → anulat → programat
// — server-ul acceptă doar anularea pentru zile viitoare („Ziua viitoare acceptă doar anularea”,
// pool.routes.mjs postSessions), altfel nicio placă „programat” nu era acționabilă (A-8).
const NEXT_STATE: Record<string, PoolSessionStatus | null> = {
  unmarked: 'present',
  present: 'absent',
  absent: 'excused',
  excused: null,
  scheduled: 'cancelled',
  cancelled: null,
};

// Doar „Anulat” apare ca text pe placă (Bazin.dc.html#22a taie numele); celelalte stări se
// citesc din culoarea punctului (legenda Venit/Lipsă/Motivat/De marcat), ca în mockup.
const STATE_LABEL: Record<string, string> = {
  cancelled: 'Anulat',
};

const DOT_TONE: Record<string, string> = {
  present: 'dotPresent',
  absent: 'dotAbsent',
  excused: 'dotExcused',
};

const DAY_NAMES = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];

function dayNumber(date: string): string {
  return String(Number(date.slice(8, 10)));
}

function dayName(date: string): string {
  return DAY_NAMES[new Date(`${date}T12:00:00`).getDay()];
}

export interface WeekViewProps {
  days: WeekDay[];
  stats: WeekStats;
  groups?: Group[];
  /** Antrenorii filialei (22a, rândul de sub carduri: „Antrenor: Nume”) — omis dacă nu e niciunul. */
  coaches?: { id: string; name: string }[];
  onCycle: (bookingId: string, date: string, next: PoolSessionStatus | null) => void;
}

/** Grila săptămânii (22a): oră × zi, clic ciclează Prezent → Lipsă → Motivat → nemarcat. */
export function WeekView({ days, stats, groups = [], coaches = [], onCycle }: WeekViewProps) {
  const times = [...new Set(days.flatMap(day => day.slots.map(slot => slot.time)))].sort();
  const todayKey = today();

  return (
    <>
      <div className={styles.cards}>
        <Card tone="orange" className={styles.statCard}>
          <span className={`${styles.statLabel} ${styles.labelOrange}`}>Programate</span>
          <span className={styles.statValue}>{stats.scheduled}</span>
        </Card>
        <Card tone="mint" className={styles.statCard}>
          <span className={`${styles.statLabel} ${styles.labelMint}`}>Prezenți</span>
          <span className={styles.statValue}>{stats.present}</span>
        </Card>
        <Card tone="pink" className={styles.statCard}>
          <span className={`${styles.statLabel} ${styles.labelPink}`}>Lipsă</span>
          <span className={styles.statValue}>{stats.absent}</span>
        </Card>
        <Card tone="yellow" className={styles.statCard}>
          <span className={`${styles.statLabel} ${styles.labelYellow}`}>Motivat</span>
          <span className={styles.statValue}>{stats.excused}</span>
        </Card>
      </div>

      <div className={styles.infoRow}>
        {coaches.length > 0 && (
          <span className={styles.coachLabel}>
            Antrenor: <strong>{coaches.map(coach => coach.name).join(', ')}</strong>
          </span>
        )}
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.dotPresent}`} />
            Venit
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.dotAbsent}`} />
            Lipsă
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.dotExcused}`} />
            Motivat
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.dotUnmarked}`} />
            De marcat
          </span>
        </div>
      </div>

      <div className={styles.grid} style={{ gridTemplateColumns: `72px repeat(${days.length}, 1fr)` }}>
        <div className={styles.headerCell} />
        {days.map(day => {
          const isToday = day.date === todayKey;
          return (
            <div key={day.date} className={`${styles.headerCell} ${isToday ? styles.headerCellToday : ''}`}>
              <span className={styles.headerNumber}>{dayNumber(day.date)}</span>
              <span className={styles.headerName}>
                {dayName(day.date)}
                {isToday ? ' · azi' : ''}
              </span>
            </div>
          );
        })}
        {times.map(time => (
          <div key={time} style={{ display: 'contents' }}>
            <div className={styles.timeCell}>{time}</div>
            {days.map(day => {
              const slot = day.slots.find(candidate => candidate.time === time);
              return (
                <div key={day.date + time} className={styles.cell}>
                  {slot?.entries.map(entry => {
                    const clickable = entry.state in NEXT_STATE;
                    // `?? 'present'` ar fi greșit aici: 'excused' și 'cancelled' duc explicit la
                    // `null` (nemarcat) — nu la fallback-ul „present" al unei stări necunoscute.
                    const next = clickable ? NEXT_STATE[entry.state] : 'present';
                    const name = entry.child?.name ?? entry.booking.childId;
                    const dotTone = DOT_TONE[entry.state] ?? 'dotUnmarked';
                    const tone = groupTone(entry.child?.groupId ?? null, groups);
                    return (
                      <button
                        key={entry.booking.id}
                        type="button"
                        disabled={!clickable}
                        className={`${styles.tile} ${styles[entry.state] ?? ''}`}
                        onClick={() => clickable && onCycle(entry.booking.id, day.date, next)}
                      >
                        <span
                          className={styles.avatar}
                          style={{
                            background: `var(--${tone}-soft, var(--neutral-soft))`,
                            color: `var(--${tone}-ink, var(--subtle))`,
                          }}
                        >
                          {initials(name)}
                        </span>
                        <span className={styles.tileName}>{name}</span>
                        {STATE_LABEL[entry.state] && (
                          <span className={styles.tileState}>{STATE_LABEL[entry.state]}</span>
                        )}
                        <span className={`${styles.dot} ${styles[dotTone]}`} />
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <p className={styles.note}>
        Zilele trecute și ziua de azi se pot marca. Zilele viitoare arată doar programul. O programare anulată pentru o
        zi (sărbătoare, bazin închis) apare tăiată și nu se taxează.
      </p>
    </>
  );
}
