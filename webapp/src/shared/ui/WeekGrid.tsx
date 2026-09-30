import styles from './WeekGrid.module.css';

export interface WeekGridEvent {
  key: string;
  dayIndex: number;
  startRow: number;
  rowSpan: number;
  label: string;
  onClick?: () => void;
}

export interface WeekGridProps {
  dayLabels: string[];
  hourLabels: string[];
  events: WeekGridEvent[];
  /** Clic pe o celulă goală (zi, oră) — pentru creare precompletată. */
  onEmptyCellClick?: (dayIndex: number, hourIndex: number) => void;
  /** V1: dimensiunea celulei e o oră întreagă (`startRow`/`rowSpan` pe rânduri de oră), nu minute exacte —
   * poziționarea la minut e un follow-up. Adevărat dimensiune-schelet nu e implementată; `loading` doar dimensiune și dezactivează clic-urile. */
  loading?: boolean;
  className?: string;
}

/** Zile × ore, pentru Bazin — bloc de eveniment cu bară ink 3px, clic pe gol = creare (COMPONENTE.md §0e, 30g). */
export function WeekGrid({ dayLabels, hourLabels, events, onEmptyCellClick, loading, className }: WeekGridProps) {
  const columns = dayLabels.length;
  const rows = hourLabels.length;
  const classes = [styles.grid, loading ? styles.loading : '', className].filter(Boolean).join(' ');

  const occupied = new Set<string>();
  for (const event of events) {
    for (let r = event.startRow; r < event.startRow + event.rowSpan; r++) {
      occupied.add(`${event.dayIndex}:${r}`);
    }
  }

  return (
    <div
      className={classes}
      style={{ gridTemplateColumns: `72px repeat(${columns}, 1fr)`, gridTemplateRows: `32px repeat(${rows}, 44px)` }}
    >
      <div className={styles.cornerCell} />
      {dayLabels.map((label, index) => (
        <div key={index} className={styles.dayHeader} style={{ gridColumn: index + 2, gridRow: 1 }}>
          {label}
        </div>
      ))}
      {hourLabels.map((label, index) => (
        <div key={index} className={styles.hourLabel} style={{ gridColumn: 1, gridRow: index + 2 }}>
          {label}
        </div>
      ))}

      {hourLabels.map((_, hourIndex) =>
        dayLabels.map((_, dayIndex) => {
          if (occupied.has(`${dayIndex}:${hourIndex}`)) return null;
          return (
            <button
              key={`${dayIndex}-${hourIndex}`}
              type="button"
              className={styles.emptyCell}
              style={{ gridColumn: dayIndex + 2, gridRow: hourIndex + 2 }}
              disabled={loading || !onEmptyCellClick}
              onClick={() => onEmptyCellClick?.(dayIndex, hourIndex)}
              aria-label={`${dayLabels[dayIndex]} ${hourLabels[hourIndex]} — liber`}
            />
          );
        }),
      )}

      {events.map(event => (
        <button
          key={event.key}
          type="button"
          className={styles.event}
          style={{
            gridColumn: event.dayIndex + 2,
            gridRow: `${event.startRow + 2} / span ${event.rowSpan}`,
          }}
          onClick={event.onClick}
          disabled={loading || !event.onClick}
        >
          {event.label}
        </button>
      ))}
    </div>
  );
}
