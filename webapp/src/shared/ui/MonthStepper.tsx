import styles from './MonthStepper.module.css';

const MONTH_NAMES = [
  'Ianuarie',
  'Februarie',
  'Martie',
  'Aprilie',
  'Mai',
  'Iunie',
  'Iulie',
  'August',
  'Septembrie',
  'Octombrie',
  'Noiembrie',
  'Decembrie',
];

export interface MonthStepperProps {
  /** YYYY-MM */
  value: string;
  onPrev: () => void;
  onNext: () => void;
}

/** Pill „‹ Luna Anul ›" fără meniu — pentru ecrane care își gestionează propria lună (nu se sincronizează cu selectorul global). */
export function MonthStepper({ value, onPrev, onNext }: MonthStepperProps) {
  const [year, month] = value.split('-').map(Number);
  return (
    <div className={styles.root}>
      <button type="button" aria-label="Luna anterioară" className={styles.arrow} onClick={onPrev}>
        ‹
      </button>
      <span className={styles.label}>
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <button type="button" aria-label="Luna următoare" className={styles.arrow} onClick={onNext}>
        ›
      </button>
    </div>
  );
}
