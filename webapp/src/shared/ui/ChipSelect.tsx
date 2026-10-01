import type { PillTone } from './FilterPills';
import styles from './ChipSelect.module.css';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  /** Nuanță proprie opțiunii (fundal/text soft, ca FilterPills/Badge) — ignorată când e selectată
   * (selecția rămâne mereu `--slate` plin). Ex. tonul fiecărei grupe în ChildFormDrawer. */
  tone?: PillTone;
  /** Indiciu afișat ca tooltip nativ (`title`) — ex. locurile libere ale unei grupe. */
  hint?: string;
}

export interface ChipSelectProps<T extends string> {
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

/** Pastile de alegere unică (22b „zile”, `COMPONENTE.md` §2) — implicit fundal `--neutral-soft`,
 * selectat = `--slate` plin. */
export function ChipSelect<T extends string>({ options, value, onChange, ariaLabel }: ChipSelectProps<T>) {
  return (
    <div className={styles.group} role="radiogroup" aria-label={ariaLabel}>
      {options.map(option => {
        const active = option.value === value;
        const toneClass = !active && option.tone && option.tone !== 'neutral' ? styles[option.tone] : '';
        const classes = [styles.pill, active ? styles.active : '', toneClass].filter(Boolean).join(' ');
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            title={option.hint}
            className={classes}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
