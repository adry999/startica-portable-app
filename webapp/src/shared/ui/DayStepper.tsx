import { formatDayLabel } from '#shared/format/date-format.mjs';
import { shiftDays } from '#shared/domain/calendar-month.mjs';
import { Icon } from './Icon';
import styles from './DayStepper.module.css';

export interface DayStepperProps {
  /** YYYY-MM-DD */
  value: string;
  onChange: (date: string) => void;
  /** Nicio zi viitoare — săgeata înainte e dezactivată la value >= max. */
  max: string;
  label?: string;
}

/** Pill „‹ Joi, 24 septembrie ›” din antetul Prezența (18a), fără zile viitoare. */
export function DayStepper({ value, onChange, max, label }: DayStepperProps) {
  return (
    <div className={styles.root}>
      <button
        type="button"
        aria-label="Ziua anterioară"
        className={styles.arrow}
        onClick={() => onChange(shiftDays(value, -1))}
      >
        <Icon name="chevron-left" />
      </button>
      <span className={styles.label}>{label ?? formatDayLabel(value)}</span>
      <button
        type="button"
        aria-label="Ziua următoare"
        className={styles.arrow}
        disabled={value >= max}
        onClick={() => onChange(shiftDays(value, 1))}
      >
        <Icon name="chevron-right" />
      </button>
    </div>
  );
}
