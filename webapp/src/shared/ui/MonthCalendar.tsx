import type { ReactNode } from 'react';
import { Tooltip } from './Tooltip';
import styles from './MonthCalendar.module.css';

export type MonthCalendarTone = 'orange' | 'mint' | 'yellow' | 'teal' | 'pink' | 'neutral';

export interface MonthCalendarEvent {
  key: string;
  label: string;
  tone?: MonthCalendarTone;
}

export interface MonthCalendarDay {
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday?: boolean;
  events: MonthCalendarEvent[];
}

export interface MonthCalendarProps {
  weekdayLabels: string[];
  /** Grila completă de 42 de celule (6 săptămâni), deja calculată de apelant. */
  days: MonthCalendarDay[];
  maxVisibleEvents?: number;
  /** Data selectată (evidențiată separat de „azi") — control extern, ca la un DatePicker. */
  selected?: string;
  onSelect?: (date: string) => void;
  /** Înălțime fixă a celulei, pentru ecrane cu mai mult conținut pe zi (ex. Vizite). */
  cellHeight?: number;
  /** Înlocuiește conținutul implicit (număr + pastile) — apelantul desenează tot ce vrea în celulă. */
  renderCell?: (day: MonthCalendarDay) => ReactNode;
  loading?: boolean;
  className?: string;
}

/**
 * Calendar lunar cu evenimente ca pastile (COMPONENTE.md §0e, 30h). V1: peste `maxVisibleEvents`
 * pastile arată un „+N” cu un `Tooltip` care listează restul — un `Popover` clicabil rămâne follow-up.
 */
export function MonthCalendar({
  weekdayLabels,
  days,
  maxVisibleEvents = 3,
  selected,
  onSelect,
  cellHeight,
  renderCell,
  loading,
  className,
}: MonthCalendarProps) {
  const classes = [styles.calendar, loading ? styles.loading : '', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className={styles.weekdays}>
        {weekdayLabels.map((label, index) => (
          <span key={index} className={styles.weekday}>
            {label}
          </span>
        ))}
      </div>
      <div className={styles.grid}>
        {days.map(day => {
          const visible = day.events.slice(0, maxVisibleEvents);
          const overflow = day.events.slice(maxVisibleEvents);
          const dayClasses = [
            styles.day,
            day.isCurrentMonth ? '' : styles.adjacent,
            day.isToday ? styles.today : '',
            selected === day.date ? styles.selected : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={day.date} className={styles.dayWrap}>
              <button
                type="button"
                className={dayClasses}
                style={cellHeight ? { minHeight: cellHeight } : undefined}
                disabled={!onSelect}
                onClick={onSelect ? () => onSelect(day.date) : undefined}
              >
                {renderCell ? (
                  renderCell(day)
                ) : (
                  <>
                    <span className={styles.dayNumber}>{day.dayNumber}</span>
                    <div className={styles.pills}>
                      {visible.map(event => (
                        <span key={event.key} className={`${styles.pill} ${styles[`tone-${event.tone ?? 'neutral'}`]}`}>
                          {event.label}
                        </span>
                      ))}
                      {overflow.length > 0 && (
                        <Tooltip content={overflow.map(event => event.label).join(', ')}>
                          <span className={styles.overflow}>+{overflow.length}</span>
                        </Tooltip>
                      )}
                    </div>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
