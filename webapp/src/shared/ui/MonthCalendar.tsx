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
  onDayClick?: (date: string) => void;
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
  onDayClick,
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
          const dayClasses = [styles.day, day.isCurrentMonth ? '' : styles.adjacent, day.isToday ? styles.today : '']
            .filter(Boolean)
            .join(' ');

          const content = (
            <div
              className={dayClasses}
              role={onDayClick ? 'button' : undefined}
              tabIndex={onDayClick ? 0 : undefined}
              onClick={onDayClick ? () => onDayClick(day.date) : undefined}
              onKeyDown={
                onDayClick
                  ? event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onDayClick(day.date);
                      }
                    }
                  : undefined
              }
            >
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
            </div>
          );

          return (
            <div key={day.date} className={styles.dayWrap}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
