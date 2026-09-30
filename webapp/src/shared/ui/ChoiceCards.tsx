import styles from './ChoiceCards.module.css';

export interface ChoiceCardOption<T extends string> {
  value: T;
  title: string;
  sub?: string;
  disabled?: boolean;
}

export interface ChoiceCardsProps<T extends string> {
  options: readonly ChoiceCardOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** Numărul de coloane ale grilei — implicit numărul de opțiuni. */
  columns?: number;
}

/** Carduri selectabile (22b „ore cu locuri”, `COMPONENTE.md` §2) — selectat = border 1.5px
 * `--orange` + `--orange-soft`; `disabled` pentru ora plină. */
export function ChoiceCards<T extends string>({ options, value, onChange, ariaLabel, columns }: ChoiceCardsProps<T>) {
  return (
    <div
      className={styles.grid}
      role="radiogroup"
      aria-label={ariaLabel}
      style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
    >
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            className={active ? `${styles.card} ${styles.active}` : styles.card}
            onClick={() => onChange(option.value)}
          >
            <span className={styles.title}>{option.title}</span>
            {option.sub && <span className={styles.sub}>{option.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}
