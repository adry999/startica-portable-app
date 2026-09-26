import { Fragment, type ReactNode } from 'react';
import styles from './FilterPills.module.css';

export type PillTone = 'orange' | 'mint' | 'yellow' | 'pink' | 'neutral';

export interface FilterPillGroup<T extends string> {
  label: string;
  options: { value: T; label: string; tone: PillTone }[];
  value: T;
  onChange: (value: T) => void;
}

export interface FilterPillsProps {
  /** 1-2 grupuri, separate vizual printr-un despărțitor. */
  groups: FilterPillGroup<string>[];
  /** Contor la capătul barei, ex. „12 zile de naștere". */
  trailing?: ReactNode;
}

/** Bara de filtre cu pastile colorate — sub bara de căutare, în Copii, Vizite, Achitări, Cheltuieli, Situația și Zile de naștere. */
export function FilterPills({ groups, trailing }: FilterPillsProps) {
  return (
    <div className={styles.bar} role="toolbar">
      {groups.map((group, index) => (
        <Fragment key={group.label}>
          {index > 0 && <span className={styles.sep} aria-hidden="true" />}
          <span className={styles.label}>{group.label}</span>
          <div role="radiogroup" aria-label={group.label} className={styles.group}>
            {group.options.map(option => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={option.value === group.value}
                className={`${styles.pill} ${styles[option.tone]} ${option.value === group.value ? styles.active : ''}`}
                onClick={() => group.onChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Fragment>
      ))}
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </div>
  );
}
