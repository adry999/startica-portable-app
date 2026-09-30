import styles from './StepList.module.css';

export interface StepListItem {
  key: string;
  label: string;
  status: 'done' | 'current' | 'pending';
  /** Durata pasului terminat, ex. „1,2 s” — gol pentru current/pending. */
  duration?: string;
}

export interface StepListProps {
  steps: StepListItem[];
  className?: string;
}

/** Lista pașilor de pornire, cu bulină și durată (21a, ALINIERE-DESIGN.md A8). */
export function StepList({ steps, className }: StepListProps) {
  const classes = className ? `${styles.list} ${className}` : styles.list;
  return (
    <ol className={classes}>
      {steps.map(step => (
        <li key={step.key} className={`${styles.step} ${styles[step.status]}`}>
          <span className={styles.marker} aria-hidden="true">
            {step.status === 'done' ? '✓' : ''}
          </span>
          <span className={styles.label}>{step.label}</span>
          <span className={styles.duration}>{step.duration}</span>
        </li>
      ))}
    </ol>
  );
}
