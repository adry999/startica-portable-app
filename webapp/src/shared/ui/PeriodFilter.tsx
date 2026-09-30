import styles from './PeriodFilter.module.css';

export interface PeriodFilterProps {
  label?: string;
  /** YYYY-MM, poate fi gol. */
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  fromAriaLabel?: string;
  toAriaLabel?: string;
}

/**
 * Interval de luni pentru bara de filtre (27e, COMPONENTE.md §0b) — varianta minimă, cu 2
 * `type="month"`, pentru ecranele care au azi doar un interval „de la – până la" (Achitări).
 * Presetările din spec (luna curentă, luna trecută, 30 zile, an școlar, tot) rămân pentru
 * ecranul care le va folosi efectiv prima dată — nu sunt construite speculativ aici.
 */
export function PeriodFilter({
  label = 'Perioadă',
  from,
  to,
  onFromChange,
  onToChange,
  fromAriaLabel = `${label} de la`,
  toAriaLabel = `${label} până la`,
}: PeriodFilterProps) {
  return (
    <label className={styles.field}>
      {label}
      <span className={styles.inputs}>
        <input
          type="month"
          value={from}
          onChange={event => onFromChange(event.target.value)}
          aria-label={fromAriaLabel}
        />
        <span aria-hidden="true">–</span>
        <input type="month" value={to} onChange={event => onToChange(event.target.value)} aria-label={toAriaLabel} />
      </span>
    </label>
  );
}
