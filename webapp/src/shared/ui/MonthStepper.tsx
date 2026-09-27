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
  /** `'yellow'` (implicit) — Zile de naștere, Personal · `'white'` — Prezența/Luna, Raport, ca DayStepper
   * (1.6 din audit: pilula galbenă e doar pe Dashboard/Situația/Zile de naștere; restul steperelor fără meniu sunt albe). */
  tone?: 'yellow' | 'white';
}

/** Pill „‹ Luna Anul ›" fără meniu — pentru ecrane care își gestionează propria lună (nu se sincronizează cu selectorul global). */
export function MonthStepper({ value, onPrev, onNext, tone = 'yellow' }: MonthStepperProps) {
  const [year, month] = value.split('-').map(Number);
  const rootClass = tone === 'white' ? `${styles.root} ${styles.white}` : styles.root;
  const arrowClass = tone === 'white' ? `${styles.arrow} ${styles.arrowWhite}` : styles.arrow;
  return (
    <div className={rootClass}>
      <button type="button" aria-label="Luna anterioară" className={arrowClass} onClick={onPrev}>
        ‹
      </button>
      <span className={styles.label}>
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <button type="button" aria-label="Luna următoare" className={arrowClass} onClick={onNext}>
        ›
      </button>
    </div>
  );
}
