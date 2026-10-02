import { Button } from './Button';
import styles from './WeekFillBar.module.css';

export interface WeekFillBarProps {
  /** „6 – 10 oct”, calculat de apelant (formatShortDayMonth pe luni/vineri). */
  weekLabel: string;
  onFillPresent: () => void;
  onCopyPreviousWeek: () => void;
  fillingPresent?: boolean;
  fillingCopyPreviousWeek?: boolean;
  className?: string;
}

/**
 * Completare rapidă pe săptămână (41b, COMPONENTE.md) — în antetul pontajului. Ambele acțiuni
 * completează doar celulele goale, niciodată una deja marcată — vezi `timesheet-week-fill.mjs`.
 */
export function WeekFillBar({
  weekLabel,
  onFillPresent,
  onCopyPreviousWeek,
  fillingPresent = false,
  fillingCopyPreviousWeek = false,
  className,
}: WeekFillBarProps) {
  const classes = [styles.bar, className].filter(Boolean).join(' ');
  const busy = fillingPresent || fillingCopyPreviousWeek;

  return (
    <div className={classes}>
      <strong className={styles.label}>{weekLabel}</strong>
      <div className={styles.actions}>
        <Button variant="mint" onClick={onFillPresent} loading={fillingPresent} disabled={busy && !fillingPresent}>
          Toți prezenți L–V
        </Button>
        <Button
          variant="outline"
          onClick={onCopyPreviousWeek}
          loading={fillingCopyPreviousWeek}
          disabled={busy && !fillingCopyPreviousWeek}
        >
          Copiază săpt. trecută
        </Button>
      </div>
    </div>
  );
}
