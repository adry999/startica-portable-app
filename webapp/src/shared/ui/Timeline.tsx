import styles from './Timeline.module.css';

export interface TimelineEntry {
  key: string;
  /** Ex. "12 septembrie 2026, 14:30". */
  timestamp: string;
  title: string;
  description?: string;
}

export interface TimelineProps {
  entries: TimelineEntry[];
  className?: string;
}

/** Listă verticală cu marcaj și linie de conexiune (COMPONENTE.md §0f, 31e) — istoric cronologic (fișa angajatului). */
export function Timeline({ entries, className }: TimelineProps) {
  const classes = className ? `${styles.timeline} ${className}` : styles.timeline;
  return (
    <ul className={classes}>
      {entries.map((entry, index) => (
        <li key={entry.key} className={styles.entry}>
          <div className={styles.markerCol}>
            <span className={styles.dot} aria-hidden="true" />
            {index < entries.length - 1 && <span className={styles.line} aria-hidden="true" />}
          </div>
          <div className={styles.content}>
            <span className={styles.timestamp}>{entry.timestamp}</span>
            <strong className={styles.title}>{entry.title}</strong>
            {entry.description != null && entry.description !== '' && (
              <span className={styles.description}>{entry.description}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
