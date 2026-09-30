import { Checkbox } from './Checkbox';
import styles from './TaskRow.module.css';

export interface TaskRowProps {
  label: string;
  done: boolean;
  onToggle: (done: boolean) => void;
  /** Ex. "Scadent azi" — text opțional, mic, lângă etichetă. */
  meta?: string;
  className?: string;
}

/** Rând de bifat într-o listă (COMPONENTE.md §0i, 34k) — etichetă tăiată și estompată când `done`. */
export function TaskRow({ label, done, onToggle, meta, className }: TaskRowProps) {
  const classes = className ? `${styles.row} ${className}` : styles.row;
  return (
    <div className={classes}>
      <Checkbox checked={done} onChange={onToggle} ariaLabel={label} />
      <span className={done ? `${styles.label} ${styles.done}` : styles.label}>{label}</span>
      {meta != null && meta !== '' && <span className={styles.meta}>{meta}</span>}
    </div>
  );
}
